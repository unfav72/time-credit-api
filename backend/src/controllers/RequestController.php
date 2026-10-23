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

        $stmt = $pdo->prepare("
            INSERT INTO service_requests (offer_id, learner_id, teacher_id, proposed_start_at, requested_duration_minutes, message, status)
            VALUES (:offer_id, :learner_id, :teacher_id, :proposed_start_at, :requested_duration_minutes, :message, 'Pending')
        ");
        $stmt->execute([
            'offer_id' => $offerId,
            'learner_id' => $user['id'],
            'teacher_id' => $offer['teacher_id'],
            'proposed_start_at' => date('Y-m-d H:i:s', strtotime($proposedStartAt)),
            'requested_duration_minutes' => $requestedDurationMinutes,
            'message' => $message
        ]);

        $requestId = Database::getLastInsertId($pdo, 'service_requests');

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

        $stmt = $pdo->prepare('SELECT * FROM service_requests WHERE id = :id');
        $stmt->execute(['id' => $requestId]);
        $req = $stmt->fetch();

        if (!$req || (int)$req['teacher_id'] !== (int)$user['id']) {
            AuthMiddleware::jsonResponse(['error' => 'Unauthorized or request not found.'], 403);
            return;
        }

        if ($req['status'] !== 'Pending') {
            AuthMiddleware::jsonResponse(['error' => 'Only Pending requests can be accepted.'], 400);
            return;
        }

        $pdo->beginTransaction();
        try {
            // Update request
            $update = $pdo->prepare("UPDATE service_requests SET status = 'Accepted' WHERE id = :id");
            $update->execute(['id' => $requestId]);

            // Create live session record
            $startAt = $req['proposed_start_at'];
            $endAt = date('Y-m-d H:i:s', strtotime($startAt . " + {$req['requested_duration_minutes']} minutes"));
            $roomId = 'timecredit-room-' . bin2hex(random_bytes(6));

            $sessStmt = $pdo->prepare("
                INSERT INTO sessions (request_id, teacher_id, learner_id, scheduled_start_at, scheduled_end_at, meeting_room_id, status)
                VALUES (:request_id, :teacher_id, :learner_id, :start_at, :end_at, :room_id, 'SCHEDULED')
            ");
            $sessStmt->execute([
                'request_id' => $requestId,
                'teacher_id' => $req['teacher_id'],
                'learner_id' => $req['learner_id'],
                'start_at' => $startAt,
                'end_at' => $endAt,
                'room_id' => $roomId
            ]);

            // Notify learner
            $notif = $pdo->prepare('INSERT INTO notifications (user_id, title, message) VALUES (:uid, :title, :msg)');
            $notif->execute([
                'uid' => $req['learner_id'],
                'title' => 'Session Request Accepted!',
                'msg' => $user['full_name'] . ' accepted your session request. Meeting room: ' . $roomId
            ]);

            $pdo->commit();
            AuthMiddleware::jsonResponse(['message' => 'Request accepted and live session scheduled!', 'room_id' => $roomId]);
        } catch (\Exception $e) {
            $pdo->rollBack();
            AuthMiddleware::jsonResponse(['error' => 'Failed to accept session: ' . $e->getMessage()], 500);
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
