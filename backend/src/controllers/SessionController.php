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

        if ((int)$session['teacher_id'] !== (int)$user['id'] && (int)$session['learner_id'] !== (int)$user['id']) {
            AuthMiddleware::jsonResponse(['error' => 'Unauthorized to join this live classroom session.'], 403);
            return;
        }

        // Record participant entry
        $part = $pdo->prepare('
            INSERT INTO session_participants (session_id, user_id, joined_at)
            VALUES (:sess_id, :user_id, NOW())
        ');
        $part->execute(['sess_id' => $sessionId, 'user_id' => $user['id']]);

        // If SCHEDULED, change to IN_PROGRESS and mark actual_start_at
        if ($session['status'] === 'SCHEDULED') {
            $upd = $pdo->prepare("UPDATE sessions SET status = 'IN_PROGRESS', actual_start_at = NOW() WHERE id = :id");
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

        $durationMinutes = (int)($input['duration_minutes'] ?? 60);
        $idempotencyKey = $input['idempotency_key'] ?? ('SETTLE_MANUAL_' . $sessionId . '_' . time());

        // Check if session exists and user is participant
        $stmt = $pdo->prepare('
            SELECT s.*, so.credit_rate 
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

        if ((int)$session['teacher_id'] !== (int)$user['id'] && (int)$session['learner_id'] !== (int)$user['id']) {
            AuthMiddleware::jsonResponse(['error' => 'Unauthorized to complete this session.'], 403);
            return;
        }

        if ($session['status'] === 'COMPLETED') {
            AuthMiddleware::jsonResponse(['error' => 'Session is already completed and settled.'], 400);
            return;
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

            // Row locking on credit accounts to prevent concurrent double-spending
            $teacherId = (int)$session['teacher_id'];
            $learnerId = (int)$session['learner_id'];

            // Lock accounts ordered by ID
            $firstId = min($teacherId, $learnerId);
            $secondId = max($teacherId, $learnerId);

            $pdo->prepare('SELECT id, balance FROM credit_accounts WHERE user_id = :id FOR UPDATE')->execute(['id' => $firstId]);
            $pdo->prepare('SELECT id, balance FROM credit_accounts WHERE user_id = :id FOR UPDATE')->execute(['id' => $secondId]);

            // Fetch learner account
            $learnerStmt = $pdo->prepare('SELECT id, balance FROM credit_accounts WHERE user_id = :id');
            $learnerStmt->execute(['id' => $learnerId]);
            $learnerAcc = $learnerStmt->fetch();

            $teacherStmt = $pdo->prepare('SELECT id, balance FROM credit_accounts WHERE user_id = :id');
            $teacherStmt->execute(['id' => $teacherId]);
            $teacherAcc = $teacherStmt->fetch();

            if (!$learnerAcc || (float)$learnerAcc['balance'] < $calculatedCredits) {
                $pdo->rollBack();
                AuthMiddleware::jsonResponse(['error' => 'Learner has insufficient TimeCredits for settlement.'], 400);
                return;
            }

            // Create credit transaction
            $txnStmt = $pdo->prepare("
                INSERT INTO credit_transactions (session_id, idempotency_key, transaction_type, status)
                VALUES (:sess_id, :key, 'SESSION_SETTLEMENT', 'COMMITTED')
            ");
            $txnStmt->execute([
                'sess_id' => $sessionId,
                'key' => $idempotencyKey
            ]);
            $txnId = Database::getLastInsertId($pdo, 'credit_transactions');

            // Double-entry ledger entries: DEBIT learner, CREDIT teacher
            $ledgerDebit = $pdo->prepare("
                INSERT INTO credit_ledger_entries (transaction_id, account_id, entry_type, amount)
                VALUES (:txn_id, :acc_id, 'DEBIT', :amount)
            ");
            $ledgerDebit->execute(['txn_id' => $txnId, 'acc_id' => $learnerAcc['id'], 'amount' => $calculatedCredits]);

            $ledgerCredit = $pdo->prepare("
                INSERT INTO credit_ledger_entries (transaction_id, account_id, entry_type, amount)
                VALUES (:txn_id, :acc_id, 'CREDIT', :amount)
            ");
            $ledgerCredit->execute(['txn_id' => $txnId, 'acc_id' => $teacherAcc['id'], 'amount' => $calculatedCredits]);

            // Update account balances
            $updLearner = $pdo->prepare('UPDATE credit_accounts SET balance = balance - :amount WHERE id = :id');
            $updLearner->execute(['amount' => $calculatedCredits, 'id' => $learnerAcc['id']]);

            $updTeacher = $pdo->prepare('UPDATE credit_accounts SET balance = balance + :amount WHERE id = :id');
            $updTeacher->execute(['amount' => $calculatedCredits, 'id' => $teacherAcc['id']]);

            // Update session
            $updSess = $pdo->prepare("
                UPDATE sessions 
                SET status = 'COMPLETED', actual_end_at = NOW(), eligible_duration_minutes = :dur 
                WHERE id = :id
            ");
            $updSess->execute(['dur' => $durationMinutes, 'id' => $sessionId]);

            // Update service request
            $pdo->prepare("UPDATE service_requests SET status = 'Completed' WHERE id = :rid")
                ->execute(['rid' => $session['request_id']]);

            // Log audit record
            $audit = $pdo->prepare("
                INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, reason)
                VALUES (:actor, 'SESSION_SETTLED', 'sessions', :sid, :reason)
            ");
            $audit->execute([
                'actor' => $user['id'],
                'sid' => $sessionId,
                'reason' => "Session settled. Transferred {$calculatedCredits} TimeCredits."
            ]);

            $pdo->commit();

            AuthMiddleware::jsonResponse([
                'message' => 'Session successfully completed and TimeCredits settled!',
                'credits_transferred' => $calculatedCredits,
                'duration_minutes' => $durationMinutes
            ]);
        } catch (\Exception $e) {
            $pdo->rollBack();
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

        $ins = $pdo->prepare('
            INSERT INTO reviews (session_id, reviewer_id, reviewed_user_id, rating, comment)
            VALUES (:sid, :rid, :ruid, :rating, :comment)
            ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment)
        ');
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
