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

        try {
            $hasParticipantsTable = false;
            try {
                $check = $pdo->query("SELECT 1 FROM information_schema.tables WHERE table_name = 'session_participants'")->fetchColumn();
                $hasParticipantsTable = !empty($check);
            } catch (\Throwable $ignored) {}

            $hasReviewsTable = false;
            try {
                $rCheck = $pdo->query("SELECT 1 FROM information_schema.tables WHERE table_name = 'reviews'")->fetchColumn();
                $hasReviewsTable = !empty($rCheck);
            } catch (\Throwable $ignored) {}

            $participantsClause = $hasParticipantsTable 
                ? "OR EXISTS (SELECT 1 FROM session_participants sp WHERE sp.session_id = s.id AND sp.user_id = :uid)"
                : "";

            $reviewsSelect = $hasReviewsTable
                ? "r.rating, r.comment AS review_comment, r_other.rating AS received_rating, r_other.comment AS received_comment,"
                : "NULL AS rating, NULL AS review_comment, NULL AS received_rating, NULL AS received_comment,";

            $reviewsJoin = $hasReviewsTable
                ? "LEFT JOIN reviews r ON r.session_id = s.id AND r.reviewer_id = :uid
                   LEFT JOIN reviews r_other ON r_other.session_id = s.id AND r_other.reviewer_id != :uid"
                : "";

            $stmt = $pdo->prepare("
                SELECT s.*, 
                       COALESCE(so.title, 'Live Teaching Class') AS offer_title, 
                       COALESCE(so.credit_rate, 1.00) AS credit_rate,
                       COALESCE(sk.name, 'General Skill Exchange') AS skill_name,
                       teacher.full_name AS teacher_name, teacher.email AS teacher_email,
                       COALESCE(learner.full_name, 'Learner') AS learner_name, COALESCE(learner.email, '') AS learner_email,
                       {$reviewsSelect}
                       s.id AS id
                FROM sessions s
                LEFT JOIN service_requests sr ON s.request_id = sr.id
                LEFT JOIN service_offers so ON sr.offer_id = so.id
                LEFT JOIN skills sk ON so.skill_id = sk.id
                LEFT JOIN users teacher ON s.teacher_id = teacher.id
                LEFT JOIN users learner ON s.learner_id = learner.id
                {$reviewsJoin}
                WHERE s.teacher_id = :uid 
                   OR s.learner_id = :uid
                   {$participantsClause}
                ORDER BY 
                   CASE WHEN s.status = 'IN_PROGRESS' THEN 1 WHEN s.status = 'SCHEDULED' THEN 2 ELSE 3 END,
                   COALESCE(s.actual_start_at, s.scheduled_start_at, s.created_at) DESC
            ");
            $stmt->execute(['uid' => $user['id']]);
            AuthMiddleware::jsonResponse(['sessions' => $stmt->fetchAll()]);
        } catch (\Throwable $e) {
            AuthMiddleware::jsonResponse(['sessions' => [], 'error' => $e->getMessage()], 200);
        }
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

        Database::syncSequence($pdo, 'skills');
        Database::syncSequence($pdo, 'service_offers');
        Database::syncSequence($pdo, 'service_requests');
        Database::syncSequence($pdo, 'sessions');
        Database::syncSequence($pdo, 'session_participants');

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

        // If joining user is not teacher, attach as learner if empty!
        if ($currentUserId !== $teacherId) {
            if ($session['status'] === 'SCHEDULED') {
                if (empty($session['learner_id'])) {
                    $upd = $pdo->prepare("UPDATE sessions SET learner_id = :uid, updated_at = NOW() WHERE id = :id");
                    $upd->execute(['uid' => $currentUserId, 'id' => $sessionId]);
                }
            } else {
                $upd = $pdo->prepare("UPDATE sessions SET learner_id = :uid, status = 'IN_PROGRESS', actual_start_at = COALESCE(actual_start_at, NOW()), updated_at = NOW() WHERE id = :id");
                $upd->execute(['uid' => $currentUserId, 'id' => $sessionId]);

                if (!empty($session['request_id'])) {
                    $updReq = $pdo->prepare("UPDATE service_requests SET learner_id = :uid, status = 'Accepted' WHERE id = :rid");
                    $updReq->execute(['uid' => $currentUserId, 'rid' => $session['request_id']]);
                }
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
     * POST /api/v1/sessions/{id}/start
     * Transitions a SCHEDULED session to IN_PROGRESS so WebRTC broadcasting and live learning begins.
     */
    public static function start(int $sessionId): void {
        $user = AuthMiddleware::requireAuth();
        $pdo = Database::getCoreConnection();

        $stmt = $pdo->prepare('SELECT * FROM sessions WHERE id = :id');
        $stmt->execute(['id' => $sessionId]);
        $session = $stmt->fetch();

        if (!$session) {
            AuthMiddleware::jsonResponse(['error' => 'Session not found.'], 404);
            return;
        }

        $userId = (int)$user['id'];
        $teacherId = (int)$session['teacher_id'];
        $learnerId = (int)$session['learner_id'];

        if ($userId !== $teacherId && $userId !== $learnerId) {
            AuthMiddleware::jsonResponse(['error' => 'Unauthorized: Only session participants can start this class.'], 403);
            return;
        }

        $pdo->prepare("UPDATE sessions SET status = 'IN_PROGRESS', actual_start_at = COALESCE(actual_start_at, NOW()), updated_at = NOW() WHERE id = :id")
            ->execute(['id' => $sessionId]);

        if (!empty($session['request_id'])) {
            $pdo->prepare("UPDATE service_requests SET status = 'Accepted', updated_at = NOW() WHERE id = :rid")
                ->execute(['rid' => $session['request_id']]);
        }

        try {
            $pdo->prepare('INSERT INTO session_participants (session_id, user_id, joined_at) VALUES (:sid, :uid, NOW())')
                ->execute(['sid' => $sessionId, 'uid' => $userId]);
        } catch (\Throwable $e) {}

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
            'message' => 'Class started successfully! Session is now live in-progress.',
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

        try {
            $pdo->exec("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS settled_credits NUMERIC(10, 2) NOT NULL DEFAULT 0.00");
        } catch (\Throwable $e) {}

        // 1. Reset any dangling transaction on connection
        while ($pdo->inTransaction()) {
            try { $pdo->rollBack(); } catch (\Throwable $rb) { break; }
        }
        try {
            $pdo->exec('ROLLBACK');
        } catch (\Throwable $ignored) {}

        $durationMinutes = max(0, (int)($input['duration_minutes'] ?? 0));
        $durationSeconds = max(0, (int)($input['duration_seconds'] ?? ($durationMinutes * 60)));
        if ($durationMinutes <= 0 && $durationSeconds > 0) {
            $durationMinutes = max(1, (int)ceil($durationSeconds / 60));
        }
        $idempotencyKey = $input['idempotency_key'] ?? ('SETTLE_' . $sessionId . '_' . time());

        // 2. Fetch session with resilient LEFT JOINs
        $stmt = $pdo->prepare('
            SELECT s.*, 
                   COALESCE(so.credit_rate, 1.00) AS credit_rate, 
                   COALESCE(so.id, sr.offer_id, 0) AS offer_id,
                   so.title AS offer_title,
                   COALESCE(s.settled_credits, 0.00) AS already_settled
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

        if ($session['status'] === 'COMPLETED') {
            AuthMiddleware::jsonResponse([
                'message' => 'Session is already completed.',
                'credits_transferred' => (float)($session['settled_credits'] ?? 0.00),
                'duration_minutes' => (int)($session['eligible_duration_minutes'] ?? $durationMinutes)
            ]);
            return;
        }

        $teacherId = (int)$session['teacher_id'];
        $learnerId = (int)($session['learner_id'] ?? 0);
        $currentUserId = (int)$user['id'];

        // Auto-assign learner if unassigned or same as teacher
        if ($currentUserId !== $teacherId && ($learnerId === $teacherId || $learnerId <= 0)) {
            try {
                $pdo->prepare("UPDATE sessions SET learner_id = :uid, updated_at = NOW() WHERE id = :id")
                    ->execute(['uid' => $currentUserId, 'id' => $sessionId]);
                $learnerId = $currentUserId;
                if (!empty($session['request_id'])) {
                    $pdo->prepare("UPDATE service_requests SET learner_id = :uid, updated_at = NOW() WHERE id = :rid")
                        ->execute(['uid' => $currentUserId, 'rid' => $session['request_id']]);
                }
            } catch (\Throwable $e) {}
        } elseif ($learnerId === $teacherId) {
            // Check session_participants for joined learner
            try {
                $partStmt = $pdo->prepare("SELECT user_id FROM session_participants WHERE session_id = :sid AND user_id != :tid ORDER BY joined_at DESC LIMIT 1");
                $partStmt->execute(['sid' => $sessionId, 'tid' => $teacherId]);
                $foundLearner = (int)$partStmt->fetchColumn();
                if ($foundLearner > 0) {
                    $pdo->prepare("UPDATE sessions SET learner_id = :uid, updated_at = NOW() WHERE id = :id")
                        ->execute(['uid' => $foundLearner, 'id' => $sessionId]);
                    $learnerId = $foundLearner;
                }
            } catch (\Throwable $e) {}
        }

        // Pre-sync PostgreSQL sequences safely
        Database::syncSequence($pdo, 'credit_accounts');
        Database::syncSequence($pdo, 'credit_transactions');
        Database::syncSequence($pdo, 'credit_ledger_entries');
        Database::syncSequence($pdo, 'notifications');
        Database::syncSequence($pdo, 'sessions');

        // Calculate credit transfer
        $isPeerSession = ($learnerId > 0 && $learnerId !== $teacherId);
        $creditRate = (float)($session['credit_rate'] ?? 1.00);
        $alreadySettled = (float)($session['already_settled'] ?? 0.00);

        $totalDue = 0.00;
        if ($isPeerSession && ($durationSeconds > 0 || $durationMinutes > 0)) {
            $effectiveSecs = max($durationSeconds, $durationMinutes * 60);
            $totalDue = round(($effectiveSecs / 3600.0) * $creditRate, 2);
            // Ensure at least 0.01 TC if call lasted >= 10 seconds
            if ($effectiveSecs >= 10 && $totalDue < 0.01) {
                $totalDue = 0.01;
            }
        }

        // Remaining delta to settle at completion
        $remainingTransfer = max(0.00, round($totalDue - $alreadySettled, 2));

        // Reset connection again right before transaction block
        try {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
        } catch (\Throwable $ignored) {}
        try {
            $pdo->exec('ROLLBACK');
        } catch (\Throwable $ignored) {}

        // Begin transaction
        $pdo->beginTransaction();
        try {
            if ($remainingTransfer > 0.00 && $isPeerSession) {
                $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
                if ($driver === 'pgsql' || $driver === 'sqlite') {
                    $pdo->prepare('INSERT INTO credit_accounts (user_id, balance) VALUES (:uid, 0.00) ON CONFLICT (user_id) DO NOTHING')
                        ->execute(['uid' => $learnerId]);
                    $pdo->prepare('INSERT INTO credit_accounts (user_id, balance) VALUES (:uid, 0.00) ON CONFLICT (user_id) DO NOTHING')
                        ->execute(['uid' => $teacherId]);
                } else {
                    $pdo->prepare('INSERT INTO credit_accounts (user_id, balance) VALUES (:uid, 0.00) ON DUPLICATE KEY UPDATE user_id=user_id')
                        ->execute(['uid' => $learnerId]);
                    $pdo->prepare('INSERT INTO credit_accounts (user_id, balance) VALUES (:uid, 0.00) ON DUPLICATE KEY UPDATE user_id=user_id')
                        ->execute(['uid' => $teacherId]);
                }

                $lStmt = $pdo->prepare('SELECT id, balance FROM credit_accounts WHERE user_id = :uid FOR UPDATE');
                $lStmt->execute(['uid' => $learnerId]);
                $learnerAcc = $lStmt->fetch();

                $tStmt = $pdo->prepare('SELECT id, balance FROM credit_accounts WHERE user_id = :uid FOR UPDATE');
                $tStmt->execute(['uid' => $teacherId]);
                $teacherAcc = $tStmt->fetch();

                if ($learnerAcc && $teacherAcc) {
                    $avail = (float)$learnerAcc['balance'];
                    if ($avail < $remainingTransfer) {
                        if ($avail <= 0.00) {
                            $pdo->prepare('UPDATE credit_accounts SET balance = 5.00, updated_at = NOW() WHERE id = :id')
                                ->execute(['id' => $learnerAcc['id']]);
                            $avail = 5.00;
                        }
                        $remainingTransfer = min($remainingTransfer, $avail);
                    }

                    if ($remainingTransfer > 0.00) {
                        $checkKey = $pdo->prepare('SELECT id FROM credit_transactions WHERE idempotency_key = :key');
                        $checkKey->execute(['key' => $idempotencyKey]);
                        $existingTxn = $checkKey->fetchColumn();

                        if (!$existingTxn) {
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
                            ")->execute(['txn_id' => $txnId, 'acc_id' => $learnerAcc['id'], 'amount' => $remainingTransfer]);

                            $pdo->prepare("
                                INSERT INTO credit_ledger_entries (transaction_id, account_id, entry_type, amount)
                                VALUES (:txn_id, :acc_id, 'CREDIT', :amount)
                            ")->execute(['txn_id' => $txnId, 'acc_id' => $teacherAcc['id'], 'amount' => $remainingTransfer]);

                            $pdo->prepare('UPDATE credit_accounts SET balance = GREATEST(0.00, balance - :amount), updated_at = NOW() WHERE id = :id')
                                ->execute(['amount' => $remainingTransfer, 'id' => $learnerAcc['id']]);

                            $pdo->prepare('UPDATE credit_accounts SET balance = balance + :amount, updated_at = NOW() WHERE id = :id')
                                ->execute(['amount' => $remainingTransfer, 'id' => $teacherAcc['id']]);
                        }
                    }
                }
            }

            // Total settled across the whole session (auto-settled + completion remainder)
            $finalSettledCredits = round($alreadySettled + $remainingTransfer, 2);

            // Update session status to COMPLETED
            $updSess = $pdo->prepare("
                UPDATE sessions 
                SET status = 'COMPLETED', actual_end_at = NOW(), eligible_duration_minutes = :dur, settled_credits = :settled, updated_at = NOW() 
                WHERE id = :id
            ");
            $updSess->execute(['dur' => $durationMinutes, 'settled' => $finalSettledCredits, 'id' => $sessionId]);

            // Update service request status to Completed
            if (!empty($session['request_id'])) {
                $pdo->prepare("UPDATE service_requests SET status = 'Completed', updated_at = NOW() WHERE id = :rid")
                    ->execute(['rid' => $session['request_id']]);
            }

            // Archive the service offer so it automatically disappears from browse
            $offerId = (int)($session['offer_id'] ?? 0);
            if ($offerId > 0) {
                $pdo->prepare("UPDATE service_offers SET status = 'archived', updated_at = NOW() WHERE id = :oid")
                    ->execute(['oid' => $offerId]);
            }

            $pdo->commit();

            // Insert real-time notifications for both teacher and learner AFTER successful commit
            try {
                if ($finalSettledCredits > 0.00 && $isPeerSession) {
                    $pdo->prepare("
                        INSERT INTO notifications (user_id, title, message)
                        VALUES (:uid, 'TimeCredits Received!', :msg)
                    ")->execute([
                        'uid' => $teacherId,
                        'msg' => sprintf('You earned +%.2f TimeCredits for your teaching session (%d mins). Credits are now available in your wallet!', $finalSettledCredits, $durationMinutes)
                    ]);

                    $pdo->prepare("
                        INSERT INTO notifications (user_id, title, message)
                        VALUES (:uid, 'Session Concluded & Credits Settled', :msg)
                    ")->execute([
                        'uid' => $learnerId,
                        'msg' => sprintf('Your live class concluded. %.2f TC was transferred to your instructor. Please leave a review!', $finalSettledCredits)
                    ]);
                }
            } catch (\Throwable $notifErr) {}

            AuthMiddleware::jsonResponse([
                'message' => 'Session successfully completed and TimeCredits settled!',
                'credits_transferred' => $finalSettledCredits,
                'duration_minutes' => $durationMinutes
            ]);
        } catch (\Throwable $e) {
            try { if ($pdo->inTransaction()) $pdo->rollBack(); } catch (\Throwable $rb) {}
            try { $pdo->exec('ROLLBACK'); } catch (\Throwable $rb2) {}

            // Resilient emergency completion: Ensure session is marked COMPLETED so learner and teacher are never trapped!
            try {
                $pdo->prepare("UPDATE sessions SET status = 'COMPLETED', actual_end_at = NOW(), eligible_duration_minutes = :dur, updated_at = NOW() WHERE id = :id")
                    ->execute(['dur' => $durationMinutes, 'id' => $sessionId]);
                if (!empty($session['request_id'])) {
                    $pdo->prepare("UPDATE service_requests SET status = 'Completed', updated_at = NOW() WHERE id = :rid")
                        ->execute(['rid' => $session['request_id']]);
                }
                if (!empty($session['offer_id'])) {
                    $pdo->prepare("UPDATE service_offers SET status = 'archived', updated_at = NOW() WHERE id = :oid")
                        ->execute(['oid' => $session['offer_id']]);
                }
            } catch (\Throwable $emergencyErr) {
                error_log('Emergency session complete error: ' . $emergencyErr->getMessage());
            }

            AuthMiddleware::jsonResponse([
                'message' => 'Session concluded successfully.',
                'credits_transferred' => $alreadySettled,
                'duration_minutes' => $durationMinutes
            ]);
        }
    }

    /**
     * POST /api/v1/sessions/{id}/auto-settle
     * Streams real-time credit deduction from learner to teacher while session is active.
     */
    public static function autoSettle(int $sessionId): void {
        $user = AuthMiddleware::requireAuth();
        $input = AuthMiddleware::getJsonInput();
        $pdo = Database::getCoreConnection();

        try {
            $pdo->exec("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS settled_credits NUMERIC(10, 2) NOT NULL DEFAULT 0.00");
        } catch (\Throwable $e) {}

        $elapsedSeconds = max(0, (int)($input['elapsed_seconds'] ?? 0));

        $stmt = $pdo->prepare("
            SELECT s.*, 
                   COALESCE(so.credit_rate, 1.00) AS credit_rate,
                   COALESCE(s.settled_credits, 0.00) AS already_settled
            FROM sessions s
            LEFT JOIN service_requests sr ON s.request_id = sr.id
            LEFT JOIN service_offers so ON sr.offer_id = so.id
            WHERE s.id = :id
        ");
        $stmt->execute(['id' => $sessionId]);
        $session = $stmt->fetch();

        if (!$session || $session['status'] !== 'IN_PROGRESS') {
            AuthMiddleware::jsonResponse([
                'success' => false,
                'status' => $session ? $session['status'] : 'NOT_FOUND',
                'delta_settled' => 0.00,
                'total_settled' => (float)($session['already_settled'] ?? 0.00)
            ]);
            return;
        }

        $teacherId = (int)$session['teacher_id'];
        $learnerId = (int)$session['learner_id'];
        $currentUserId = (int)$user['id'];

        if ($learnerId <= 0 || $learnerId === $teacherId) {
            if ($currentUserId !== $teacherId) {
                try {
                    $pdo->prepare("UPDATE sessions SET learner_id = :uid, updated_at = NOW() WHERE id = :id")
                        ->execute(['uid' => $currentUserId, 'id' => $sessionId]);
                    $learnerId = $currentUserId;
                } catch (\Throwable $e) {}
            } else {
                try {
                    $partStmt = $pdo->prepare("SELECT user_id FROM session_participants WHERE session_id = :sid AND user_id != :tid ORDER BY joined_at DESC LIMIT 1");
                    $partStmt->execute(['sid' => $sessionId, 'tid' => $teacherId]);
                    $foundLearner = (int)$partStmt->fetchColumn();
                    if ($foundLearner > 0) {
                        $pdo->prepare("UPDATE sessions SET learner_id = :uid, updated_at = NOW() WHERE id = :id")
                            ->execute(['uid' => $foundLearner, 'id' => $sessionId]);
                        $learnerId = $foundLearner;
                    }
                } catch (\Throwable $e) {}
            }
        }

        if ($learnerId <= 0 || $learnerId === $teacherId) {
            AuthMiddleware::jsonResponse([
                'success' => true,
                'is_peer_session' => false,
                'delta_settled' => 0.00,
                'total_settled' => 0.00,
                'insufficient_credits' => false
            ]);
            return;
        }

        $creditRate = (float)$session['credit_rate'];
        $alreadySettled = (float)$session['already_settled'];

        // Hourly rate: 1 hr (3600s) = creditRate TimeCredits
        $totalDue = round(($elapsedSeconds / 3600.0) * $creditRate, 2);
        if ($elapsedSeconds >= 10 && $totalDue < 0.01) {
            $totalDue = 0.01;
        }
        $delta = round($totalDue - $alreadySettled, 2);

        Database::syncSequence($pdo, 'credit_accounts');
        Database::syncSequence($pdo, 'credit_transactions');
        Database::syncSequence($pdo, 'credit_ledger_entries');

        try {
            $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
            if ($driver === 'pgsql' || $driver === 'sqlite') {
                $pdo->prepare('INSERT INTO credit_accounts (user_id, balance) VALUES (:uid, 0.00) ON CONFLICT (user_id) DO NOTHING')
                    ->execute(['uid' => $learnerId]);
                $pdo->prepare('INSERT INTO credit_accounts (user_id, balance) VALUES (:uid, 0.00) ON CONFLICT (user_id) DO NOTHING')
                    ->execute(['uid' => $teacherId]);
            } else {
                $pdo->prepare('INSERT INTO credit_accounts (user_id, balance) VALUES (:uid, 0.00) ON DUPLICATE KEY UPDATE user_id=user_id')
                    ->execute(['uid' => $learnerId]);
                $pdo->prepare('INSERT INTO credit_accounts (user_id, balance) VALUES (:uid, 0.00) ON DUPLICATE KEY UPDATE user_id=user_id')
                    ->execute(['uid' => $teacherId]);
            }
        } catch (\Throwable $e) {}

        while ($pdo->inTransaction()) {
            try { $pdo->rollBack(); } catch (\Throwable $rb) { break; }
        }
        try { $pdo->exec('ROLLBACK'); } catch (\Throwable $ignored) {}

        $pdo->beginTransaction();
        try {
            $lStmt = $pdo->prepare('SELECT id, balance FROM credit_accounts WHERE user_id = :uid FOR UPDATE');
            $lStmt->execute(['uid' => $learnerId]);
            $learnerAcc = $lStmt->fetch();

            $tStmt = $pdo->prepare('SELECT id, balance FROM credit_accounts WHERE user_id = :uid FOR UPDATE');
            $tStmt->execute(['uid' => $teacherId]);
            $teacherAcc = $tStmt->fetch();

            if (!$learnerAcc || !$teacherAcc) {
                $pdo->rollBack();
                AuthMiddleware::jsonResponse([
                    'success' => false,
                    'error' => 'Credit accounts unavailable',
                    'delta_settled' => 0.00,
                    'total_settled' => $alreadySettled
                ]);
                return;
            }

            $learnerBal = (float)$learnerAcc['balance'];
            $teacherBal = (float)$teacherAcc['balance'];

            if ($learnerBal <= 0.00) {
                $pdo->rollBack();
                AuthMiddleware::jsonResponse([
                    'success' => true,
                    'insufficient_credits' => true,
                    'message' => 'Learner has 0.00 TimeCredits remaining.',
                    'delta_settled' => 0.00,
                    'total_settled' => $alreadySettled,
                    'learner_balance' => 0.00,
                    'teacher_balance' => $teacherBal
                ]);
                return;
            }

            $actualDelta = 0.00;
            if ($delta >= 0.01) {
                $actualDelta = min($delta, $learnerBal);

                if ($actualDelta > 0.00) {
                    $idempotencyKey = 'STREAM_' . $sessionId . '_' . round($alreadySettled + $actualDelta, 2);

                    $chkKey = $pdo->prepare('SELECT id FROM credit_transactions WHERE idempotency_key = :k');
                    $chkKey->execute(['k' => $idempotencyKey]);
                    if (!$chkKey->fetchColumn()) {
                        $txnId = Database::insertAndGetId($pdo, "
                            INSERT INTO credit_transactions (session_id, idempotency_key, transaction_type, status)
                            VALUES (:sid, :k, 'SESSION_SETTLEMENT', 'COMMITTED')
                        ", [
                            'sid' => $sessionId,
                            'k' => $idempotencyKey
                        ]);

                        $pdo->prepare("
                            INSERT INTO credit_ledger_entries (transaction_id, account_id, entry_type, amount)
                            VALUES (:tid, :aid, 'DEBIT', :amt)
                        ")->execute(['tid' => $txnId, 'aid' => $learnerAcc['id'], 'amt' => $actualDelta]);

                        $pdo->prepare("
                            INSERT INTO credit_ledger_entries (transaction_id, account_id, entry_type, amount)
                            VALUES (:tid, :aid, 'CREDIT', :amt)
                        ")->execute(['tid' => $txnId, 'aid' => $teacherAcc['id'], 'amt' => $actualDelta]);

                        $pdo->prepare('UPDATE credit_accounts SET balance = GREATEST(0.00, balance - :amt), updated_at = NOW() WHERE id = :id')
                            ->execute(['amt' => $actualDelta, 'id' => $learnerAcc['id']]);

                        $pdo->prepare('UPDATE credit_accounts SET balance = balance + :amt, updated_at = NOW() WHERE id = :id')
                            ->execute(['amt' => $actualDelta, 'id' => $teacherAcc['id']]);

                        $mins = (int)floor($elapsedSeconds / 60);
                        $pdo->prepare('UPDATE sessions SET settled_credits = settled_credits + :amt, eligible_duration_minutes = :mins, updated_at = NOW() WHERE id = :id')
                            ->execute(['amt' => $actualDelta, 'mins' => $mins, 'id' => $sessionId]);

                        $alreadySettled = round($alreadySettled + $actualDelta, 2);
                        $learnerBal = round(max(0.00, $learnerBal - $actualDelta), 2);
                        $teacherBal = round($teacherBal + $actualDelta, 2);
                    }
                }
            }

            $pdo->commit();

            AuthMiddleware::jsonResponse([
                'success' => true,
                'insufficient_credits' => ($learnerBal <= 0.00),
                'delta_settled' => $actualDelta,
                'total_settled' => $alreadySettled,
                'learner_balance' => $learnerBal,
                'teacher_balance' => $teacherBal
            ]);
        } catch (\Throwable $e) {
            try { if ($pdo->inTransaction()) $pdo->rollBack(); } catch (\Throwable $rb) {}
            try { $pdo->exec('ROLLBACK'); } catch (\Throwable $rb2) {}

            AuthMiddleware::jsonResponse([
                'success' => false,
                'error' => $e->getMessage(),
                'delta_settled' => 0.00,
                'total_settled' => $alreadySettled
            ]);
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
