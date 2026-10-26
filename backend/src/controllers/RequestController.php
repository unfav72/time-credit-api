<?php
declare(strict_types=1);

namespace TimeCredit\Controllers;

use PDO;
use TimeCredit\Middleware\AuthMiddleware;
use TimeCredit\Repositories\Database;

class RequestController {
    /**
     * POST /api/v1/requests
     */
    public static function create(): void {
        $user = AuthMiddleware::requireAuth();
        $input = AuthMiddleware::getJsonInput();

        $offerId = (int)($input['offer_id'] ?? 0);
        $proposedStartAt = $input['proposed_start_at'] ?? '';
        $requestedDurationMinutes = (int)($input['requested_duration_minutes'] ?? 60);
        $message = trim($input['message'] ?? '');

        if ($offerId <= 0 || empty($proposedStartAt)) {
            AuthMiddleware::jsonResponse(['error' => 'Offer ID and proposed date/time are required.'], 422);
            return;
        }

        $pdo = Database::getCoreConnection();

        // Fetch offer and teacher
        $stmt = $pdo->prepare("SELECT teacher_id, title FROM service_offers WHERE id = :offer_id AND status = 'active'");
        $stmt->execute(['offer_id' => $offerId]);
        $offer = $stmt->fetch();

        if (!$offer) {
            AuthMiddleware::jsonResponse(['error' => 'Service offer not found or inactive.'], 404);
            return;
        }

        if ((int)$offer['teacher_id'] === (int)$user['id']) {
            AuthMiddleware::jsonResponse(['error' => 'You cannot book a session with yourself.'], 400);
            return;
        }

        // Check learner balance
        $balStmt = $pdo->prepare('SELECT balance FROM credit_accounts WHERE user_id = :user_id');
        $balStmt->execute(['user_id' => $user['id']]);
        $acc = $balStmt->fetch();
        if (!$acc || (float)$acc['balance'] < 0.5) {
            AuthMiddleware::jsonResponse(['error' => 'Insufficient TimeCredits. You need at least 0.50 credits to book a session.'], 400);
            return;
        }

        $requestId = Database::insertAndGetId($pdo, "
            INSERT INTO service_requests (offer_id, learner_id, teacher_id, proposed_start_at, requested_duration_minutes, message, status)
            VALUES (:offer_id, :learner_id, :teacher_id, :proposed_start_at, :requested_duration_minutes, :message, 'Pending')
        ", [
            'offer_id' => $offerId,
            'learner_id' => $user['id'],
            'teacher_id' => $offer['teacher_id'],
            'proposed_start_at' => date('Y-m-d H:i:s', strtotime($proposedStartAt)),
            'requested_duration_minutes' => $requestedDurationMinutes,
            'message' => $message
        ]);

        // Notify teacher
        $notif = $pdo->prepare('INSERT INTO notifications (user_id, title, message) VALUES (:uid, :title, :msg)');
        $notif->execute([
            'uid' => $offer['teacher_id'],
            'title' => 'New Session Request Received',
            'msg' => $user['full_name'] . ' requested a ' . $requestedDurationMinutes . '-minute session for "' . $offer['title'] . '".'
        ]);

        AuthMiddleware::jsonResponse(['message' => 'Service request sent successfully!', 'id' => $requestId], 201);
    }

    /**
     * GET /api/v1/requests
     */
    public static function index(): void {
        $user = AuthMiddleware::requireAuth();
        $pdo = Database::getCoreConnection();

        $stmt = $pdo->prepare('
            SELECT sr.*,
                   so.title AS offer_title, so.credit_rate,
                   s.name AS skill_name,
                   teacher.full_name AS teacher_name, teacher.email AS teacher_email,
                   learner.full_name AS learner_name, learner.email AS learner_email,
                   sess.id AS session_id, sess.meeting_room_id, sess.status AS session_status
            FROM service_requests sr
            JOIN service_offers so ON sr.offer_id = so.id
            JOIN skills s ON so.skill_id = s.id
            JOIN users teacher ON sr.teacher_id = teacher.id
            JOIN users learner ON sr.learner_id = learner.id
            LEFT JOIN sessions sess ON sess.request_id = sr.id
            WHERE sr.teacher_id = :uid OR sr.learner_id = :uid
            ORDER BY sr.created_at DESC
        ');
        $stmt->execute(['uid' => $user['id']]);
        AuthMiddleware::jsonResponse(['requests' => $stmt->fetchAll()]);
    }

    /**
     * POST /api/v1/requests/{id}/accept
     */
    public static function accept(int $requestId): void {
        $user = AuthMiddleware::requireAuth();
        $pdo = Database::getCoreConnection();

        Database::syncSequence($pdo, 'service_requests');
        Database::syncSequence($pdo, 'sessions');
        Database::syncSequence($pdo, 'notifications');

        $stmt = $pdo->prepare('SELECT * FROM service_requests WHERE id = :id');
        $stmt->execute(['id' => $requestId]);
        $req = $stmt->fetch();

        if (!$req || (int)$req['teacher_id'] !== (int)$user['id']) {
            AuthMiddleware::jsonResponse(['error' => 'Unauthorized or request not found.'], 403);
            return;
        }

        if ($req['status'] !== 'Pending' && $req['status'] !== 'Accepted') {
            AuthMiddleware::jsonResponse(['error' => 'Only Pending requests can be accepted.'], 400);
            return;
        }

        $pdo->beginTransaction();
        try {
            // Update request
            $update = $pdo->prepare("UPDATE service_requests SET status = 'Accepted', updated_at = NOW() WHERE id = :id");
            $update->execute(['id' => $requestId]);

            // Create or update live session record
            $startAt = !empty($req['proposed_start_at']) ? $req['proposed_start_at'] : date('Y-m-d H:i:s');
            $duration = max(15, (int)($req['requested_duration_minutes'] ?: 60));
            $endAt = date('Y-m-d H:i:s', strtotime($startAt . " + {$duration} minutes"));
            $roomId = 'tc-live-' . bin2hex(random_bytes(5));

            $chk = $pdo->prepare('SELECT id FROM sessions WHERE request_id = :rid');
            $chk->execute(['rid' => $requestId]);
            $existingId = $chk->fetchColumn();

            $sessionId = 0;
            if ($existingId) {
                $sessionId = (int)$existingId;
                $pdo->prepare("UPDATE sessions SET status = 'IN_PROGRESS', actual_start_at = COALESCE(actual_start_at, NOW()), updated_at = NOW() WHERE id = :id")
                    ->execute(['id' => $sessionId]);
            } else {
                $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
                if ($driver === 'pgsql') {
                    $sessStmt = $pdo->prepare("
                        INSERT INTO sessions (request_id, teacher_id, learner_id, scheduled_start_at, scheduled_end_at, actual_start_at, meeting_room_id, status)
                        VALUES (:request_id, :teacher_id, :learner_id, :start_at, :end_at, NOW(), :room_id, 'IN_PROGRESS')
                        ON CONFLICT (request_id) DO UPDATE SET status = 'IN_PROGRESS', actual_start_at = COALESCE(sessions.actual_start_at, NOW()), updated_at = NOW()
                        RETURNING id
                    ");
                    $sessStmt->execute([
                        'request_id' => $requestId,
                        'teacher_id' => $req['teacher_id'],
                        'learner_id' => $req['learner_id'],
                        'start_at' => $startAt,
                        'end_at' => $endAt,
                        'room_id' => $roomId
                    ]);
                    $sessionId = (int)$sessStmt->fetchColumn();
                } else {
                    $sessStmt = $pdo->prepare("
                        INSERT INTO sessions (request_id, teacher_id, learner_id, scheduled_start_at, scheduled_end_at, actual_start_at, meeting_room_id, status)
                        VALUES (:request_id, :teacher_id, :learner_id, :start_at, :end_at, NOW(), :room_id, 'IN_PROGRESS')
                    ");
                    $sessStmt->execute([
                        'request_id' => $requestId,
                        'teacher_id' => $req['teacher_id'],
                        'learner_id' => $req['learner_id'],
                        'start_at' => $startAt,
                        'end_at' => $endAt,
                        'room_id' => $roomId
                    ]);
                    $sessionId = (int)$pdo->lastInsertId();
                    if ($sessionId <= 0) {
                        $sessionId = (int)$pdo->query("SELECT id FROM sessions WHERE request_id = {$requestId}")->fetchColumn();
                    }
                }
            }

            // Notify learner
            $notif = $pdo->prepare('INSERT INTO notifications (user_id, title, message) VALUES (:uid, :title, :msg)');
            $notif->execute([
                'uid' => $req['learner_id'],
                'title' => 'Session Request Accepted!',
                'msg' => $user['full_name'] . ' accepted your session request. Your live classroom is now open and ready!'
            ]);

            $pdo->commit();
            AuthMiddleware::jsonResponse([
                'message' => 'Request accepted and live session scheduled!',
                'session_id' => $sessionId,
                'room_id' => $roomId
            ]);
        } catch (\Exception $e) {
            $pdo->rollBack();
            AuthMiddleware::jsonResponse(['error' => 'Failed to accept session: ' . $e->getMessage()], 500);
        }
    }

    /**
     * POST /api/v1/requests/{id}/schedule
     * Allows the teacher to set/confirm the scheduled appointment date, time, duration, and optional meeting link.
     */
    public static function schedule(int $requestId): void {
        $user = AuthMiddleware::requireAuth();
        $input = AuthMiddleware::getJsonInput();
        $pdo = Database::getCoreConnection();

        Database::syncSequence($pdo, 'service_requests');
        Database::syncSequence($pdo, 'sessions');
        Database::syncSequence($pdo, 'notifications');

        $stmt = $pdo->prepare('SELECT * FROM service_requests WHERE id = :id');
        $stmt->execute(['id' => $requestId]);
        $req = $stmt->fetch();

        if (!$req || (int)$req['teacher_id'] !== (int)$user['id']) {
            AuthMiddleware::jsonResponse(['error' => 'Unauthorized: Only the assigned instructor can schedule this appointment.'], 403);
            return;
        }

        $scheduledStartAt = trim($input['scheduled_start_at'] ?? $input['proposed_start_at'] ?? '');
        if (empty($scheduledStartAt)) {
            $scheduledStartAt = !empty($req['proposed_start_at']) ? $req['proposed_start_at'] : date('Y-m-d H:i:s');
        } else {
            $ts = strtotime($scheduledStartAt);
            if ($ts === false) {
                AuthMiddleware::jsonResponse(['error' => 'Invalid scheduled start date and time.'], 422);
                return;
            }
            $scheduledStartAt = date('Y-m-d H:i:s', $ts);
        }

        $duration = max(15, (int)($input['duration_minutes'] ?? $input['requested_duration_minutes'] ?? $req['requested_duration_minutes'] ?? 60));
        $scheduledEndAt = date('Y-m-d H:i:s', strtotime($scheduledStartAt . " + {$duration} minutes"));
        $customMeetingLink = trim($input['meeting_link'] ?? $input['meeting_room_id'] ?? '');

        $pdo->beginTransaction();
        try {
            // Update request status to 'Scheduled'
            $updReq = $pdo->prepare("
                UPDATE service_requests 
                SET status = 'Scheduled', proposed_start_at = :start_at, requested_duration_minutes = :dur, updated_at = NOW() 
                WHERE id = :id
            ");
            $updReq->execute([
                'start_at' => $scheduledStartAt,
                'dur' => $duration,
                'id' => $requestId
            ]);

            // Check if session already exists for this request
            $chk = $pdo->prepare('SELECT id, meeting_room_id FROM sessions WHERE request_id = :rid');
            $chk->execute(['rid' => $requestId]);
            $existing = $chk->fetch();

            $roomId = $customMeetingLink;
            if (empty($roomId)) {
                $roomId = !empty($existing['meeting_room_id']) ? $existing['meeting_room_id'] : ('tc-live-' . bin2hex(random_bytes(5)));
            }

            $sessionId = 0;
            if ($existing) {
                $sessionId = (int)$existing['id'];
                $pdo->prepare("
                    UPDATE sessions 
                    SET scheduled_start_at = :start_at, scheduled_end_at = :end_at, 
                        eligible_duration_minutes = :dur, meeting_room_id = :room_id, 
                        status = 'SCHEDULED', updated_at = NOW() 
                    WHERE id = :id
                ")->execute([
                    'start_at' => $scheduledStartAt,
                    'end_at' => $scheduledEndAt,
                    'dur' => $duration,
                    'room_id' => $roomId,
                    'id' => $sessionId
                ]);
            } else {
                $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
                if ($driver === 'pgsql') {
                    $sessStmt = $pdo->prepare("
                        INSERT INTO sessions (request_id, teacher_id, learner_id, scheduled_start_at, scheduled_end_at, eligible_duration_minutes, meeting_room_id, status)
                        VALUES (:request_id, :teacher_id, :learner_id, :start_at, :end_at, :dur, :room_id, 'SCHEDULED')
                        ON CONFLICT (request_id) DO UPDATE SET 
                            scheduled_start_at = EXCLUDED.scheduled_start_at, 
                            scheduled_end_at = EXCLUDED.scheduled_end_at, 
                            eligible_duration_minutes = EXCLUDED.eligible_duration_minutes,
                            meeting_room_id = EXCLUDED.meeting_room_id,
                            status = 'SCHEDULED', updated_at = NOW()
                        RETURNING id
                    ");
                    $sessStmt->execute([
                        'request_id' => $requestId,
                        'teacher_id' => $req['teacher_id'],
                        'learner_id' => $req['learner_id'],
                        'start_at' => $scheduledStartAt,
                        'end_at' => $scheduledEndAt,
                        'dur' => $duration,
                        'room_id' => $roomId
                    ]);
                    $sessionId = (int)$sessStmt->fetchColumn();
                } else {
                    $sessStmt = $pdo->prepare("
                        INSERT INTO sessions (request_id, teacher_id, learner_id, scheduled_start_at, scheduled_end_at, eligible_duration_minutes, meeting_room_id, status)
                        VALUES (:request_id, :teacher_id, :learner_id, :start_at, :end_at, :dur, :room_id, 'SCHEDULED')
                    ");
                    $sessStmt->execute([
                        'request_id' => $requestId,
                        'teacher_id' => $req['teacher_id'],
                        'learner_id' => $req['learner_id'],
                        'start_at' => $scheduledStartAt,
                        'end_at' => $scheduledEndAt,
                        'dur' => $duration,
                        'room_id' => $roomId
                    ]);
                    $sessionId = (int)$pdo->lastInsertId();
                    if ($sessionId <= 0) {
                        $sessionId = (int)$pdo->query("SELECT id FROM sessions WHERE request_id = {$requestId}")->fetchColumn();
                    }
                }
            }

            // Fetch offer title for friendly notification
            $offStmt = $pdo->prepare("SELECT title FROM service_offers WHERE id = :oid");
            $offStmt->execute(['oid' => $req['offer_id']]);
            $offTitle = $offStmt->fetchColumn() ?: 'Skill Mentorship Class';

            $formattedTime = date('D, M j, Y \a\t g:i A', strtotime($scheduledStartAt));

            // Notify learner with confirmed scheduled time
            $notif = $pdo->prepare('INSERT INTO notifications (user_id, title, message) VALUES (:uid, :title, :msg)');
            $notif->execute([
                'uid' => $req['learner_id'],
                'title' => 'Appointment Scheduled & Confirmed!',
                'msg' => "Instructor {$user['full_name']} scheduled your appointment for \"{$offTitle}\" on {$formattedTime} ({$duration} mins). You will be able to join the class from your Sessions or Requests page."
            ]);

            $pdo->commit();

            AuthMiddleware::jsonResponse([
                'success' => true,
                'message' => 'Appointment successfully scheduled and confirmed!',
                'session_id' => $sessionId,
                'scheduled_start_at' => $scheduledStartAt,
                'scheduled_end_at' => $scheduledEndAt,
                'duration_minutes' => $duration,
                'room_id' => $roomId
            ]);
        } catch (\Throwable $e) {
            $pdo->rollBack();
            AuthMiddleware::jsonResponse(['error' => 'Failed to schedule appointment: ' . $e->getMessage()], 500);
        }
    }

    /**
     * POST /api/v1/requests/{id}/reject
     */
    public static function reject(int $requestId): void {
        $user = AuthMiddleware::requireAuth();
        $pdo = Database::getCoreConnection();

        $stmt = $pdo->prepare('SELECT * FROM service_requests WHERE id = :id');
        $stmt->execute(['id' => $requestId]);
        $req = $stmt->fetch();

        if (!$req || (int)$req['teacher_id'] !== (int)$user['id']) {
            AuthMiddleware::jsonResponse(['error' => 'Unauthorized or request not found.'], 403);
            return;
        }

        $update = $pdo->prepare("UPDATE service_requests SET status = 'Rejected' WHERE id = :id");
        $update->execute(['id' => $requestId]);

        AuthMiddleware::jsonResponse(['message' => 'Request rejected.']);
    }
}
