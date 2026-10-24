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

        $stmt = $pdo->prepare('
            SELECT s.*, 
                   so.title AS offer_title, so.credit_rate,
                   sk.name AS skill_name,
                   teacher.full_name AS teacher_name, teacher.email AS teacher_email,
                   learner.full_name AS learner_name, learner.email AS learner_email,
                   r.rating, r.comment AS review_comment
            FROM sessions s
            JOIN service_requests sr ON s.request_id = sr.id
            JOIN service_offers so ON sr.offer_id = so.id
            JOIN skills sk ON so.skill_id = sk.id
            JOIN users teacher ON s.teacher_id = teacher.id
            JOIN users learner ON s.learner_id = learner.id
            LEFT JOIN reviews r ON r.session_id = s.id AND r.reviewer_id = :uid
            WHERE s.teacher_id = :uid OR s.learner_id = :uid
            ORDER BY s.scheduled_start_at DESC
        ');
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
                   so.title AS offer_title, so.credit_rate, so.description AS offer_description,
                   sk.name AS skill_name,
                   teacher.full_name AS teacher_name, teacher.email AS teacher_email,
                   learner.full_name AS learner_name, learner.email AS learner_email
            FROM sessions s
            JOIN service_requests sr ON s.request_id = sr.id
            JOIN service_offers so ON sr.offer_id = so.id
            JOIN skills sk ON so.skill_id = sk.id
            JOIN users teacher ON s.teacher_id = teacher.id
            JOIN users learner ON s.learner_id = learner.id
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

        // If joining user is not teacher, and session has no separate learner, attach as learner!
        if ((int)$user['id'] !== $teacherId && ($learnerId === $teacherId || $learnerId <= 0)) {
            $upd = $pdo->prepare("UPDATE sessions SET learner_id = :uid, status = 'IN_PROGRESS', actual_start_at = COALESCE(actual_start_at, NOW()) WHERE id = :id");
            $upd->execute(['uid' => $user['id'], 'id' => $sessionId]);

            $updReq = $pdo->prepare("UPDATE service_requests SET learner_id = :uid, status = 'Accepted' WHERE id = :rid");
            $updReq->execute(['uid' => $user['id'], 'rid' => $session['request_id']]);
            $learnerId = (int)$user['id'];
        }

        // Record participant entry
        $part = $pdo->prepare('
            INSERT INTO session_participants (session_id, user_id, joined_at)
            VALUES (:sess_id, :user_id, NOW())
        ');
        $part->execute(['sess_id' => $sessionId, 'user_id' => $user['id']]);

        // If SCHEDULED, change to IN_PROGRESS and mark actual_start_at
        if ($session['status'] === 'SCHEDULED') {
            $upd = $pdo->prepare("UPDATE sessions SET status = 'IN_PROGRESS', actual_start_at = COALESCE(actual_start_at, NOW()) WHERE id = :id");
            $upd->execute(['id' => $sessionId]);
        }

        AuthMiddleware::jsonResponse([
            'message' => 'Joined session successfully',
            'room_id' => $session['meeting_room_id'],
            'is_teacher' => (int)$session['teacher_id'] === (int)$user['id']
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

        $durationMinutes = (int)($input['duration_minutes'] ?? 0);
        $idempotencyKey = $input['idempotency_key'] ?? ('SETTLE_' . $sessionId . '_' . time());

        // Check if session exists
        $stmt = $pdo->prepare('
            SELECT s.*, so.credit_rate, sr.offer_id 
            FROM sessions s
            JOIN service_requests sr ON s.request_id = sr.id
            JOIN service_offers so ON sr.offer_id = so.id
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

        if ($teacherId !== (int)$user['id'] && $learnerId !== (int)$user['id']) {
            AuthMiddleware::jsonResponse(['error' => 'Unauthorized to complete this session.'], 403);
            return;
        }

        if ($session['status'] === 'COMPLETED') {
            AuthMiddleware::jsonResponse([
                'message' => 'Session is already completed.',
                'credits_transferred' => 0.00,
                'duration_minutes' => (int)($session['eligible_duration_minutes'] ?? $durationMinutes)
            ]);
            return;
        }

        $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);

        // Case 1: Solo/Practice session (host without external learner)
        if ($teacherId === $learnerId) {
            $pdo->beginTransaction();
            try {
                $updSess = $pdo->prepare("
                    UPDATE sessions 
                    SET status = 'COMPLETED', actual_end_at = NOW(), eligible_duration_minutes = :dur 
                    WHERE id = :id
                ");
                $updSess->execute(['dur' => $durationMinutes, 'id' => $sessionId]);

                if (!empty($session['request_id'])) {
                    $pdo->prepare("UPDATE service_requests SET status = 'Completed' WHERE id = :rid")
                        ->execute(['rid' => $session['request_id']]);
                }

                $offerId = (int)($session['offer_id'] ?? 0);
                if ($offerId > 0) {
                    $pdo->prepare("UPDATE service_offers SET status = 'archived' WHERE id = :oid")
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
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                AuthMiddleware::jsonResponse(['error' => 'Failed ending practice session: ' . $e->getMessage()], 500);
                return;
            }
        }

        // Case 2: 1-on-1 peer exchange between teacher and learner
        // 1. Ensure both users have credit_accounts rows before starting the settlement transaction
        try {
            if ($driver === 'pgsql') {
                $pdo->prepare("INSERT INTO credit_accounts (user_id, balance) VALUES (:uid, 0.00) ON CONFLICT (user_id) DO NOTHING")->execute(['uid' => $learnerId]);
                $pdo->prepare("INSERT INTO credit_accounts (user_id, balance) VALUES (:uid, 0.00) ON CONFLICT (user_id) DO NOTHING")->execute(['uid' => $teacherId]);
                // Synchronize PostgreSQL sequences to avoid pkey collision
                try { $pdo->exec("SELECT setval('credit_accounts_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM credit_accounts), 1))"); } catch (\Throwable $t) {}
                try { $pdo->exec("SELECT setval('credit_transactions_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM credit_transactions), 1))"); } catch (\Throwable $t) {}
                try { $pdo->exec("SELECT setval('credit_ledger_entries_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM credit_ledger_entries), 1))"); } catch (\Throwable $t) {}
            } else {
                $pdo->prepare("INSERT IGNORE INTO credit_accounts (user_id, balance) VALUES (:uid, 0.00)")->execute(['uid' => $learnerId]);
                $pdo->prepare("INSERT IGNORE INTO credit_accounts (user_id, balance) VALUES (:uid, 0.00)")->execute(['uid' => $teacherId]);
            }
        } catch (\Throwable $initErr) {
            // Non-fatal if sequences or rows already present
        }

        $pdo->beginTransaction();
        try {
            // Check idempotency
            $checkKey = $pdo->prepare('SELECT id FROM credit_transactions WHERE idempotency_key = :key');
            $checkKey->execute(['key' => $idempotencyKey]);
            if ($checkKey->fetch()) {
                $pdo->rollBack();
                AuthMiddleware::jsonResponse(['error' => 'Duplicate settlement transaction detected.'], 409);
                return;
            }

            // Calculate credit transfer: 1 hour = 1.0 credit * rate
            $creditRate = (float)$session['credit_rate'];
            $calculatedCredits = round(($durationMinutes / 60.0) * $creditRate, 2);

            // Fetch accounts with row locking to prevent race conditions
            $learnerStmt = $pdo->prepare('SELECT id, balance FROM credit_accounts WHERE user_id = :id FOR UPDATE');
            $learnerStmt->execute(['id' => $learnerId]);
            $learnerAcc = $learnerStmt->fetch();

            $teacherStmt = $pdo->prepare('SELECT id, balance FROM credit_accounts WHERE user_id = :id FOR UPDATE');
            $teacherStmt->execute(['id' => $teacherId]);
            $teacherAcc = $teacherStmt->fetch();

            $transferAmount = $calculatedCredits;
            if ($learnerAcc) {
                $avail = (float)$learnerAcc['balance'];
                if ($avail < $transferAmount) {
                    $transferAmount = max(0.00, $avail);
                }
            }

            if ($transferAmount > 0 && $learnerAcc && $teacherAcc) {
                if ($driver === 'pgsql') {
                    $txnStmt = $pdo->prepare("
                        INSERT INTO credit_transactions (session_id, idempotency_key, transaction_type, status)
                        VALUES (:sess_id, :key, 'SESSION_SETTLEMENT', 'COMMITTED')
                        RETURNING id
                    ");
                    $txnStmt->execute([
                        'sess_id' => $sessionId,
                        'key' => $idempotencyKey
                    ]);
                    $txnId = (int)$txnStmt->fetchColumn();
                } else {
                    $txnId = Database::insertAndGetId($pdo, "
                        INSERT INTO credit_transactions (session_id, idempotency_key, transaction_type, status)
                        VALUES (:sess_id, :key, 'SESSION_SETTLEMENT', 'COMMITTED')
                    ", ['sess_id' => $sessionId, 'key' => $idempotencyKey]);
                }

                $ledgerDebit = $pdo->prepare("
                    INSERT INTO credit_ledger_entries (transaction_id, account_id, entry_type, amount)
                    VALUES (:txn_id, :acc_id, 'DEBIT', :amount)
                ");
                $ledgerDebit->execute(['txn_id' => $txnId, 'acc_id' => $learnerAcc['id'], 'amount' => $transferAmount]);

                $ledgerCredit = $pdo->prepare("
                    INSERT INTO credit_ledger_entries (transaction_id, account_id, entry_type, amount)
                    VALUES (:txn_id, :acc_id, 'CREDIT', :amount)
                ");
                $ledgerCredit->execute(['txn_id' => $txnId, 'acc_id' => $teacherAcc['id'], 'amount' => $transferAmount]);

                $updLearner = $pdo->prepare('UPDATE credit_accounts SET balance = balance - :amount, updated_at = NOW() WHERE id = :id');
                $updLearner->execute(['amount' => $transferAmount, 'id' => $learnerAcc['id']]);

                $updTeacher = $pdo->prepare('UPDATE credit_accounts SET balance = balance + :amount, updated_at = NOW() WHERE id = :id');
                $updTeacher->execute(['amount' => $transferAmount, 'id' => $teacherAcc['id']]);
            }

            // Update session status to COMPLETED
            $updSess = $pdo->prepare("
                UPDATE sessions 
                SET status = 'COMPLETED', actual_end_at = NOW(), eligible_duration_minutes = :dur 
                WHERE id = :id
            ");
            $updSess->execute(['dur' => $durationMinutes, 'id' => $sessionId]);

            // Update service request status to Completed
            if (!empty($session['request_id'])) {
                $pdo->prepare("UPDATE service_requests SET status = 'Completed' WHERE id = :rid")
                    ->execute(['rid' => $session['request_id']]);
            }

            // Archive the service offer so it automatically disappears from the browse section
            $offerId = (int)($session['offer_id'] ?? 0);
            if ($offerId > 0) {
                $pdo->prepare("UPDATE service_offers SET status = 'archived' WHERE id = :oid")
                    ->execute(['oid' => $offerId]);
            }

            // Insert real-time notifications for both teacher and learner
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

            $pdo->commit();

            AuthMiddleware::jsonResponse([
                'message' => 'Session successfully completed and TimeCredits settled!',
                'credits_transferred' => $transferAmount,
                'duration_minutes' => $durationMinutes
            ]);
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
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
