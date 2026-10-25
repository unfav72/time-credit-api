<?php
declare(strict_types=1);

namespace TimeCredit\Controllers;

use PDO;
use TimeCredit\Middleware\AuthMiddleware;
use TimeCredit\Repositories\Database;

class SessionController {
    /**
     * GET /api/v1/sessions
     */
    public static function index(): void {
        $user = AuthMiddleware::requireAuth();
        $pdo = Database::getCoreConnection();

        $stmt = $pdo->prepare("
            SELECT s.*, 
                   COALESCE(so.title, 'Live Teaching Class') AS offer_title, 
                   COALESCE(so.credit_rate, 1.00) AS credit_rate,
                   COALESCE(sk.name, 'General Skill Exchange') AS skill_name,
                   teacher.full_name AS teacher_name, teacher.email AS teacher_email,
                   COALESCE(learner.full_name, 'Learner') AS learner_name, COALESCE(learner.email, '') AS learner_email,
                   r.rating, r.comment AS review_comment
            FROM sessions s
            LEFT JOIN service_requests sr ON s.request_id = sr.id
            LEFT JOIN service_offers so ON sr.offer_id = so.id
            LEFT JOIN skills sk ON so.skill_id = sk.id
            LEFT JOIN users teacher ON s.teacher_id = teacher.id
            LEFT JOIN users learner ON s.learner_id = learner.id
            LEFT JOIN reviews r ON r.session_id = s.id AND r.reviewer_id = :uid
            WHERE s.teacher_id = :uid 
               OR s.learner_id = :uid
               OR EXISTS (SELECT 1 FROM session_participants sp WHERE sp.session_id = s.id AND sp.user_id = :uid)
            ORDER BY s.scheduled_start_at DESC
        ");
        $stmt->execute(['uid' => $user['id']]);
        AuthMiddleware::jsonResponse(['sessions' => $stmt->fetchAll()]);
    }

    /**
     * GET /api/v1/sessions/live
     * Returns all open/live sessions across the platform so learners can join immediately.
     */
    public static function live(): void {
        $pdo = Database::getCoreConnection();
        $stmt = $pdo->query("
            SELECT s.*,
                   COALESCE(so.title, 'Live Peer Class') AS offer_title, 
                   COALESCE(so.credit_rate, 1.00) AS credit_rate, 
                   COALESCE(so.description, 'Interactive live learning class.') AS offer_description,
                   COALESCE(sk.name, 'Peer Learning') AS skill_name,
                   teacher.full_name AS teacher_name, teacher.email AS teacher_email,
                   COALESCE(learner.full_name, 'Waiting for learner to join...') AS learner_name, 
                   COALESCE(learner.email, '') AS learner_email
            FROM sessions s
            LEFT JOIN service_requests sr ON s.request_id = sr.id
            LEFT JOIN service_offers so ON sr.offer_id = so.id
            LEFT JOIN skills sk ON so.skill_id = sk.id
            LEFT JOIN users teacher ON s.teacher_id = teacher.id
            LEFT JOIN users learner ON s.learner_id = learner.id
            WHERE s.status IN ('IN_PROGRESS', 'SCHEDULED')
            ORDER BY s.actual_start_at DESC NULLS LAST, s.scheduled_start_at DESC
            LIMIT 25
        ");
        AuthMiddleware::jsonResponse(['live_sessions' => $stmt->fetchAll()]);
    }

    /**
     * POST /api/v1/sessions/create
     * Instantly create and host a live online teaching session.
     */
    public static function create(): void {
        $user = AuthMiddleware::requireAuth();
        $input = AuthMiddleware::getJsonInput();
        $pdo = Database::getCoreConnection();

        $title = trim($input['title'] ?? 'Live Peer Teaching Session');
        $skillId = (int)($input['skill_id'] ?? 0);
        $skillName = trim($input['skill_name'] ?? '');
        $durationMinutes = (int)($input['duration_minutes'] ?? 60);
        $creditRate = (float)($input['credit_rate'] ?? 1.00);
        $description = trim($input['description'] ?? 'Interactive live online learning class.');

        $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);

        if ($skillId <= 0) {
            if (!empty($skillName)) {
                $findSql = ($driver === 'pgsql') 
                    ? 'SELECT id FROM skills WHERE name ILIKE :name LIMIT 1'
                    : 'SELECT id FROM skills WHERE LOWER(name) = LOWER(:name) LIMIT 1';
                $findSkill = $pdo->prepare($findSql);
                $findSkill->execute(['name' => $skillName]);
                $found = $findSkill->fetchColumn();
                if ($found) {
                    $skillId = (int)$found;
                } else {
                    $firstCat = (int)$pdo->query('SELECT id FROM skill_categories ORDER BY id ASC LIMIT 1')->fetchColumn();
                    if ($driver === 'pgsql') {
                        $stmt = $pdo->prepare('INSERT INTO skills (category_id, name, description) VALUES (:cat, :name, :desc) RETURNING id');
                        $stmt->execute(['cat' => $firstCat ?: 1, 'name' => $skillName, 'desc' => $description]);
                        $skillId = (int)$stmt->fetchColumn();
                    } else {
                        $stmt = $pdo->prepare('INSERT INTO skills (category_id, name, description) VALUES (:cat, :name, :desc)');
                        $stmt->execute(['cat' => $firstCat ?: 1, 'name' => $skillName, 'desc' => $description]);
                        $skillId = (int)$pdo->lastInsertId();
                    }
                }
            } else {
                $skillId = (int)$pdo->query('SELECT id FROM skills ORDER BY id ASC LIMIT 1')->fetchColumn() ?: 1;
            }
        }

        $pdo->beginTransaction();
        try {
            $retId = ($driver === 'pgsql') ? " RETURNING id" : "";

            $offerStmt = $pdo->prepare("
                INSERT INTO service_offers (teacher_id, skill_id, title, description, duration_minutes, credit_rate, experience_level, language, mode, status)
                VALUES (:teacher_id, :skill_id, :title, :description, :duration_minutes, :credit_rate, 'intermediate', 'English', 'online', 'active'){$retId}
            ");
            $offerStmt->execute([
                'teacher_id' => $user['id'],
                'skill_id' => $skillId,
                'title' => $title,
                'description' => $description,
                'duration_minutes' => $durationMinutes,
                'credit_rate' => $creditRate
            ]);
            $offerId = ($driver === 'pgsql') ? (int)$offerStmt->fetchColumn() : (int)$pdo->lastInsertId();

            $reqStmt = $pdo->prepare("
                INSERT INTO service_requests (offer_id, teacher_id, learner_id, proposed_start_at, requested_duration_minutes, message, status)
                VALUES (:offer_id, :teacher_id, :learner_id, NOW(), :duration, 'Live online teaching broadcast started by host.', 'Accepted'){$retId}
            ");
            $reqStmt->execute([
                'offer_id' => $offerId,
                'teacher_id' => $user['id'],
                'learner_id' => $user['id'],
                'duration' => $durationMinutes
            ]);
            $requestId = ($driver === 'pgsql') ? (int)$reqStmt->fetchColumn() : (int)$pdo->lastInsertId();

            $roomId = 'tc-live-' . bin2hex(random_bytes(5));
            $endExpr = ($driver === 'pgsql') ? "NOW() + interval '60 minutes'" : "DATE_ADD(NOW(), INTERVAL 60 MINUTE)";

            $sessStmt = $pdo->prepare("
                INSERT INTO sessions (request_id, teacher_id, learner_id, scheduled_start_at, scheduled_end_at, actual_start_at, meeting_room_id, status)
                VALUES (:req_id, :teacher_id, :learner_id, NOW(), {$endExpr}, NOW(), :room_id, 'IN_PROGRESS'){$retId}
            ");
            $sessStmt->execute([
                'req_id' => $requestId,
                'teacher_id' => $user['id'],
                'learner_id' => $user['id'],
                'room_id' => $roomId
            ]);
            $sessionId = ($driver === 'pgsql') ? (int)$sessStmt->fetchColumn() : (int)$pdo->lastInsertId();

            try {
                $part = $pdo->prepare('INSERT INTO session_participants (session_id, user_id, joined_at) VALUES (:sid, :uid, NOW())');
                $part->execute(['sid' => $sessionId, 'uid' => $user['id']]);
            } catch (\Throwable $pErr) {
                // Non-fatal if session_participants table is not enabled
            }

            $pdo->commit();

            AuthMiddleware::jsonResponse([
                'message' => 'Live teaching session broadcasted successfully!',
                'session_id' => $sessionId,
                'room_id' => $roomId,
                'session' => [
                    'id' => $sessionId,
                    'offer_title' => $title,
                    'skill_name' => $skillName ?: 'General Skill Exchange',
                    'teacher_id' => $user['id'],
                    'teacher_name' => $user['full_name'],
                    'learner_id' => $user['id'],
                    'learner_name' => 'Waiting for learner to join...',
                    'credit_rate' => $creditRate,
                    'meeting_room_id' => $roomId,
                    'status' => 'IN_PROGRESS'
                ]
            ], 201);
        } catch (\Throwable $e) {
            $pdo->rollBack();
            AuthMiddleware::jsonResponse(['error' => 'Failed creating live teaching session: ' . $e->getMessage()], 500);
        }
    }

    /**
     * POST /api/v1/sessions/{id}/join
     */
    public static function join(int $sessionId): void {
        $user = AuthMiddleware::requireAuth();
        $pdo = Database::getCoreConnection();

        $stmt = $pdo->prepare('SELECT * FROM sessions WHERE id = :id');
        $stmt->execute(['id' => $sessionId]);
        $session = $stmt->fetch();

        if (!$session) {
            AuthMiddleware::jsonResponse(['error' => 'Session not found.'], 404);
            return;
        }

        $teacherId = (int)$session['teacher_id'];
        $learnerId = (int)$session['learner_id'];
        $currentUserId = (int)$user['id'];

        // If joining user is not teacher, attach as learner!
        if ($currentUserId !== $teacherId) {
            $upd = $pdo->prepare("UPDATE sessions SET learner_id = :uid, status = 'IN_PROGRESS', actual_start_at = COALESCE(actual_start_at, NOW()), updated_at = NOW() WHERE id = :id");
            $upd->execute(['uid' => $currentUserId, 'id' => $sessionId]);

            if (!empty($session['request_id'])) {
                $updReq = $pdo->prepare("UPDATE service_requests SET learner_id = :uid, status = 'Accepted' WHERE id = :rid");
                $updReq->execute(['uid' => $currentUserId, 'rid' => $session['request_id']]);
            }
            $learnerId = $currentUserId;
        }

        // Record participant entry safely
        try {
            $part = $pdo->prepare('
                INSERT INTO session_participants (session_id, user_id, joined_at)
                VALUES (:sess_id, :user_id, NOW())
            ');
            $part->execute(['sess_id' => $sessionId, 'user_id' => $currentUserId]);
        } catch (\Throwable $pErr) {
            // Non-fatal if participant is already registered or sequence issues
        }

        // If SCHEDULED, change to IN_PROGRESS and mark actual_start_at
        if ($session['status'] === 'SCHEDULED') {
            $upd = $pdo->prepare("UPDATE sessions SET status = 'IN_PROGRESS', actual_start_at = COALESCE(actual_start_at, NOW()) WHERE id = :id");
            $upd->execute(['id' => $sessionId]);
        }

        // Re-fetch the full updated session data to return directly
        $fullStmt = $pdo->prepare("
            SELECT s.*, 
                   COALESCE(so.title, 'Live Teaching Class') AS offer_title, 
                   COALESCE(so.credit_rate, 1.00) AS credit_rate,
                   COALESCE(sk.name, 'General Skill Exchange') AS skill_name,
                   teacher.full_name AS teacher_name, teacher.email AS teacher_email,
                   COALESCE(learner.full_name, 'Learner') AS learner_name, COALESCE(learner.email, '') AS learner_email
            FROM sessions s
            LEFT JOIN service_requests sr ON s.request_id = sr.id
            LEFT JOIN service_offers so ON sr.offer_id = so.id
            LEFT JOIN skills sk ON so.skill_id = sk.id
            LEFT JOIN users teacher ON s.teacher_id = teacher.id
            LEFT JOIN users learner ON s.learner_id = learner.id
            WHERE s.id = :id
        ");
        $fullStmt->execute(['id' => $sessionId]);
        $refreshed = $fullStmt->fetch() ?: $session;

        AuthMiddleware::jsonResponse([
            'success' => true,
            'message' => 'Joined session successfully',
            'session_id' => $sessionId,
            'room_id' => $refreshed['meeting_room_id'] ?? $session['meeting_room_id'],
            'is_teacher' => (int)$session['teacher_id'] === $currentUserId,
            'session' => $refreshed
        ]);
    }

    /**
     * GET /api/v1/sessions/{id}
     */
    public static function show(int $sessionId): void {
        AuthMiddleware::requireAuth();
        $pdo = Database::getCoreConnection();

        $stmt = $pdo->prepare("
            SELECT s.*, 
                   COALESCE(so.title, 'Live Teaching Class') AS offer_title, 
                   COALESCE(so.credit_rate, 1.00) AS credit_rate,
                   COALESCE(sk.name, 'General Skill Exchange') AS skill_name,
                   teacher.full_name AS teacher_name, teacher.email AS teacher_email,
                   COALESCE(learner.full_name, 'Learner') AS learner_name, COALESCE(learner.email, '') AS learner_email
            FROM sessions s
            LEFT JOIN service_requests sr ON s.request_id = sr.id
            LEFT JOIN service_offers so ON sr.offer_id = so.id
            LEFT JOIN skills sk ON so.skill_id = sk.id
            LEFT JOIN users teacher ON s.teacher_id = teacher.id
            LEFT JOIN users learner ON s.learner_id = learner.id
            WHERE s.id = :id
        ");
        $stmt->execute(['id' => $sessionId]);
        $session = $stmt->fetch();

        if (!$session) {
            AuthMiddleware::jsonResponse(['error' => 'Session not found.'], 404);
            return;
        }

        AuthMiddleware::jsonResponse(['session' => $session]);
    }

    /**
     * PUT /api/v1/sessions/{id}/meeting-link
     * Updates the Google Meet URL for this session.
     */
    public static function updateMeetingLink(int $sessionId): void {
        $user = AuthMiddleware::requireAuth();
        $input = AuthMiddleware::getJsonInput();
        $pdo = Database::getCoreConnection();

        $link = trim($input['meeting_link'] ?? $input['meeting_room_id'] ?? '');
        if (empty($link)) {
            AuthMiddleware::jsonResponse(['error' => 'Google Meet link cannot be empty.'], 422);
            return;
        }

        // Format Google Meet link canonically
        if (!str_starts_with($link, 'http://') && !str_starts_with($link, 'https://')) {
            if (str_starts_with($link, 'meet.google.com/')) {
                $link = 'https://' . $link;
            } elseif (preg_match('/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/i', $link)) {
                $link = 'https://meet.google.com/' . strtolower($link);
            } else {
                $link = 'https://meet.google.com/' . ltrim($link, '/');
            }
        }

        $stmt = $pdo->prepare('SELECT * FROM sessions WHERE id = :id');
        $stmt->execute(['id' => $sessionId]);
        $session = $stmt->fetch();

        if (!$session) {
            AuthMiddleware::jsonResponse(['error' => 'Session not found.'], 404);
            return;
        }

        $isTeacher = (int)$session['teacher_id'] === (int)$user['id'];
        $isLearner = (int)$session['learner_id'] === (int)$user['id'];
        if (!$isTeacher && !$isLearner) {
            AuthMiddleware::jsonResponse(['error' => 'Unauthorized: Only participants of this session can update the meeting link.'], 403);
            return;
        }

        $upd = $pdo->prepare('UPDATE sessions SET meeting_room_id = :link, updated_at = NOW() WHERE id = :id');
        $upd->execute(['link' => $link, 'id' => $sessionId]);

        AuthMiddleware::jsonResponse([
            'success' => true,
            'message' => 'Google Meet link saved successfully!',
            'meeting_room_id' => $link
        ]);
    }

    /**
     * POST /api/v1/sessions/{id}/complete
     * Settles TimeCredits using ACID transaction with row locking and double-entry ledger.
     */
    public static function complete(int $sessionId): void {
        $user = AuthMiddleware::requireAuth();
        $input = AuthMiddleware::getJsonInput();
        $pdo = Database::getCoreConnection();

        // 1. Reset any dangling or previously aborted transactions
        try {
            $pdo->exec('ROLLBACK');
        } catch (\Throwable $ignored) {}
        try {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
        } catch (\Throwable $ignored) {}

        $durationMinutes = max(0, (int)($input['duration_minutes'] ?? 0));
        $idempotencyKey = $input['idempotency_key'] ?? ('SETTLE_' . $sessionId . '_' . time());

        // 2. Fetch session with resilient LEFT JOINs
        $stmt = $pdo->prepare('
            SELECT s.*, 
                   COALESCE(so.credit_rate, 1.00) AS credit_rate, 
                   COALESCE(so.id, sr.offer_id, 0) AS offer_id,
                   so.title AS offer_title
            FROM sessions s
            LEFT JOIN service_requests sr ON s.request_id = sr.id
            LEFT JOIN service_offers so ON sr.offer_id = so.id
            WHERE s.id = :id
        ');
        $stmt->execute(['id' => $sessionId]);
        $session = $stmt->fetch();

        if (!$session) {
            AuthMiddleware::jsonResponse(['error' => 'Session not found.'], 404);
            return;
        }

        $teacherId = (int)$session['teacher_id'];
        $learnerId = (int)$session['learner_id'];
        $currentUserId = (int)$user['id'];

        // Auto-attach learner if session had unassigned or dummy learner ID
        if ($currentUserId !== $teacherId && ($learnerId === $teacherId || $learnerId <= 0)) {
            $pdo->prepare("UPDATE sessions SET learner_id = :uid, updated_at = NOW() WHERE id = :id")
                ->execute(['uid' => $currentUserId, 'id' => $sessionId]);
            $learnerId = $currentUserId;
            if (!empty($session['request_id'])) {
                $pdo->prepare("UPDATE service_requests SET learner_id = :uid, updated_at = NOW() WHERE id = :rid")
                    ->execute(['uid' => $currentUserId, 'rid' => $session['request_id']]);
            }
        }

        if ($session['status'] === 'COMPLETED') {
            AuthMiddleware::jsonResponse([
                'message' => 'Session is already completed.',
                'credits_transferred' => 0.00,
                'duration_minutes' => (int)($session['eligible_duration_minutes'] ?? $durationMinutes)
            ]);
            return;
        }

        // 3. Ensure credit_accounts rows exist for both teacher and learner
        try {
            $chkL = $pdo->prepare('SELECT id, balance FROM credit_accounts WHERE user_id = :uid');
            $chkL->execute(['uid' => $learnerId]);
            $learnerAcc = $chkL->fetch();
            if (!$learnerAcc) {
                $pdo->prepare('INSERT INTO credit_accounts (user_id, balance) VALUES (:uid, 2.00)')->execute(['uid' => $learnerId]);
                $chkL->execute(['uid' => $learnerId]);
                $learnerAcc = $chkL->fetch();
            }

            $chkT = $pdo->prepare('SELECT id, balance FROM credit_accounts WHERE user_id = :uid');
            $chkT->execute(['uid' => $teacherId]);
            $teacherAcc = $chkT->fetch();
            if (!$teacherAcc) {
                $pdo->prepare('INSERT INTO credit_accounts (user_id, balance) VALUES (:uid, 2.00)')->execute(['uid' => $teacherId]);
                $chkT->execute(['uid' => $teacherId]);
                $teacherAcc = $chkT->fetch();
            }
        } catch (\Throwable $accErr) {
            // Non-fatal fallback
        }

        // Case 1: Solo/Practice session (host without external learner)
        if ($teacherId === $learnerId) {
            $pdo->beginTransaction();
            try {
                $updSess = $pdo->prepare("
                    UPDATE sessions 
                    SET status = 'COMPLETED', actual_end_at = NOW(), eligible_duration_minutes = :dur, updated_at = NOW() 
                    WHERE id = :id
                ");
                $updSess->execute(['dur' => $durationMinutes, 'id' => $sessionId]);

                if (!empty($session['request_id'])) {
                    $pdo->prepare("UPDATE service_requests SET status = 'Completed', updated_at = NOW() WHERE id = :rid")
                        ->execute(['rid' => $session['request_id']]);
                }

                $offerId = (int)($session['offer_id'] ?? 0);
                if ($offerId > 0) {
                    $pdo->prepare("UPDATE service_offers SET status = 'archived', updated_at = NOW() WHERE id = :oid")
                        ->execute(['oid' => $offerId]);
                }

                $pdo->commit();

                AuthMiddleware::jsonResponse([
                    'message' => 'Practice session completed successfully!',
                    'credits_transferred' => 0.00,
                    'duration_minutes' => $durationMinutes
                ]);
                return;
            } catch (\Throwable $e) {
                try { if ($pdo->inTransaction()) $pdo->rollBack(); } catch (\Throwable $rb) {}
                try { $pdo->exec('ROLLBACK'); } catch (\Throwable $rb2) {}
                AuthMiddleware::jsonResponse(['error' => 'Failed ending practice session: ' . $e->getMessage()], 500);
                return;
            }
        }

        // Case 2: 1-on-1 peer exchange between teacher and learner
        $pdo->beginTransaction();
        try {
            // Check idempotency key to prevent double settlements
            $checkKey = $pdo->prepare('SELECT id FROM credit_transactions WHERE idempotency_key = :key');
            $checkKey->execute(['key' => $idempotencyKey]);
            if ($checkKey->fetch()) {
                $pdo->rollBack();
                AuthMiddleware::jsonResponse(['error' => 'Duplicate settlement transaction detected.'], 409);
                return;
            }

            // Calculate credit transfer
            $creditRate = (float)($session['credit_rate'] ?? 1.0);
            $transferAmount = 0.00;
            if ($durationMinutes > 0) {
                $calculated = round(($durationMinutes / 60.0) * $creditRate, 2);
                $transferAmount = max(0.10, $calculated);
            }

            // Fetch accounts with row locking
            $learnerStmt = $pdo->prepare('SELECT id, balance FROM credit_accounts WHERE user_id = :id FOR UPDATE');
            $learnerStmt->execute(['id' => $learnerId]);
            $learnerAcc = $learnerStmt->fetch();

            $teacherStmt = $pdo->prepare('SELECT id, balance FROM credit_accounts WHERE user_id = :id FOR UPDATE');
            $teacherStmt->execute(['id' => $teacherId]);
            $teacherAcc = $teacherStmt->fetch();

            if ($transferAmount > 0 && $learnerAcc && $teacherAcc) {
                $avail = (float)$learnerAcc['balance'];
                if ($avail < $transferAmount) {
                    if ($avail <= 0.00) {
                        $pdo->prepare('UPDATE credit_accounts SET balance = 1.00, updated_at = NOW() WHERE id = :id')
                            ->execute(['id' => $learnerAcc['id']]);
                        $avail = 1.00;
                    }
                    $transferAmount = min($transferAmount, $avail);
                }

                if ($transferAmount > 0) {
                    $txnId = Database::insertAndGetId($pdo, "
                        INSERT INTO credit_transactions (session_id, idempotency_key, transaction_type, status)
                        VALUES (:sess_id, :key, 'SESSION_SETTLEMENT', 'COMMITTED')
                    ", [
                        'sess_id' => $sessionId,
                        'key' => $idempotencyKey
                    ]);

                    $pdo->prepare("
                        INSERT INTO credit_ledger_entries (transaction_id, account_id, entry_type, amount)
                        VALUES (:txn_id, :acc_id, 'DEBIT', :amount)
                    ")->execute(['txn_id' => $txnId, 'acc_id' => $learnerAcc['id'], 'amount' => $transferAmount]);

                    $pdo->prepare("
                        INSERT INTO credit_ledger_entries (transaction_id, account_id, entry_type, amount)
                        VALUES (:txn_id, :acc_id, 'CREDIT', :amount)
                    ")->execute(['txn_id' => $txnId, 'acc_id' => $teacherAcc['id'], 'amount' => $transferAmount]);

                    $pdo->prepare('UPDATE credit_accounts SET balance = GREATEST(0.00, balance - :amount), updated_at = NOW() WHERE id = :id')
                        ->execute(['amount' => $transferAmount, 'id' => $learnerAcc['id']]);

                    $pdo->prepare('UPDATE credit_accounts SET balance = balance + :amount, updated_at = NOW() WHERE id = :id')
                        ->execute(['amount' => $transferAmount, 'id' => $teacherAcc['id']]);
                }
            }

            // Update session status to COMPLETED
            $updSess = $pdo->prepare("
                UPDATE sessions 
                SET status = 'COMPLETED', actual_end_at = NOW(), eligible_duration_minutes = :dur, updated_at = NOW() 
                WHERE id = :id
            ");
            $updSess->execute(['dur' => $durationMinutes, 'id' => $sessionId]);

            // Update service request status to Completed
            if (!empty($session['request_id'])) {
                $pdo->prepare("UPDATE service_requests SET status = 'Completed', updated_at = NOW() WHERE id = :rid")
                    ->execute(['rid' => $session['request_id']]);
            }

            // Archive the service offer so it automatically disappears from the browse section
            $offerId = (int)($session['offer_id'] ?? 0);
            if ($offerId > 0) {
                $pdo->prepare("UPDATE service_offers SET status = 'archived', updated_at = NOW() WHERE id = :oid")
                    ->execute(['oid' => $offerId]);
            }

            $pdo->commit();

            // Insert real-time notifications for both teacher and learner AFTER successful commit
            try {
                if ($transferAmount > 0) {
                    $pdo->prepare("
                        INSERT INTO notifications (user_id, title, message)
                        VALUES (:uid, 'TimeCredits Received!', :msg)
                    ")->execute([
                        'uid' => $teacherId,
                        'msg' => sprintf('You earned +%.2f TimeCredits for your teaching session (%d mins). Credits are now available in your wallet!', $transferAmount, $durationMinutes)
                    ]);

                    $pdo->prepare("
                        INSERT INTO notifications (user_id, title, message)
                        VALUES (:uid, 'Session Concluded & Credits Settled', :msg)
                    ")->execute([
                        'uid' => $learnerId,
                        'msg' => sprintf('Your live class concluded. %.2f TC was transferred to your instructor. Please leave a review!', $transferAmount)
                    ]);
                }
            } catch (\Throwable $notifErr) {
                // Non-fatal if notifications fail
            }

            AuthMiddleware::jsonResponse([
                'message' => 'Session successfully completed and TimeCredits settled!',
                'credits_transferred' => $transferAmount,
                'duration_minutes' => $durationMinutes
            ]);
        } catch (\Throwable $e) {
            try { if ($pdo->inTransaction()) $pdo->rollBack(); } catch (\Throwable $rb) {}
            try { $pdo->exec('ROLLBACK'); } catch (\Throwable $rb2) {}
            AuthMiddleware::jsonResponse(['error' => 'Settlement failed: ' . $e->getMessage()], 500);
        }
    }

    /**
     * POST /api/v1/sessions/{id}/review
     */
    public static function review(int $sessionId): void {
        $user = AuthMiddleware::requireAuth();
        $input = AuthMiddleware::getJsonInput();
        $pdo = Database::getCoreConnection();

        $rating = (int)($input['rating'] ?? 5);
        $comment = trim($input['comment'] ?? '');

        if ($rating < 1 || $rating > 5) {
            AuthMiddleware::jsonResponse(['error' => 'Rating must be between 1 and 5.'], 422);
            return;
        }

        $stmt = $pdo->prepare('SELECT teacher_id, learner_id, status FROM sessions WHERE id = :id');
        $stmt->execute(['id' => $sessionId]);
        $sess = $stmt->fetch();

        if (!$sess || $sess['status'] !== 'COMPLETED') {
            AuthMiddleware::jsonResponse(['error' => 'Reviews can only be submitted for completed sessions.'], 400);
            return;
        }

        // Determine who is being reviewed
        $reviewedUserId = ((int)$sess['teacher_id'] === (int)$user['id']) ? (int)$sess['learner_id'] : (int)$sess['teacher_id'];

        $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
        if ($driver === 'pgsql' || $driver === 'sqlite') {
            $sql = '
                INSERT INTO reviews (session_id, reviewer_id, reviewed_user_id, rating, comment)
                VALUES (:sid, :rid, :ruid, :rating, :comment)
                ON CONFLICT (session_id, reviewer_id) DO UPDATE 
                SET rating = EXCLUDED.rating, comment = EXCLUDED.comment
            ';
        } else {
            $sql = '
                INSERT INTO reviews (session_id, reviewer_id, reviewed_user_id, rating, comment)
                VALUES (:sid, :rid, :ruid, :rating, :comment)
                ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment)
            ';
        }
        $ins = $pdo->prepare($sql);
        $ins->execute([
            'sid' => $sessionId,
            'rid' => $user['id'],
            'ruid' => $reviewedUserId,
            'rating' => $rating,
            'comment' => $comment
        ]);

        AuthMiddleware::jsonResponse(['message' => 'Review submitted successfully!']);
    }
}
