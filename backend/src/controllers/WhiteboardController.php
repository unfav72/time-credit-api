<?php
declare(strict_types=1);

namespace TimeCredit\Controllers;

use PDO;
use TimeCredit\Middleware\AuthMiddleware;
use TimeCredit\Repositories\Database;

class WhiteboardController {
    /**
     * Helper to verify authenticated participant access to a session.
     */
    private static function verifySessionAccess(PDO $pdo, int $sessionId, int $userId): array {
        $stmt = $pdo->prepare('
            SELECT s.*, 
                   teacher.full_name AS teacher_name, 
                   learner.full_name AS learner_name,
                   so.title AS session_title
            FROM sessions s
            JOIN service_requests sr ON s.request_id = sr.id
            JOIN service_offers so ON sr.offer_id = so.id
            JOIN users teacher ON s.teacher_id = teacher.id
            JOIN users learner ON s.learner_id = learner.id
            WHERE s.id = :id
        ');
        $stmt->execute(['id' => $sessionId]);
        $session = $stmt->fetch();

        if (!$session) {
            AuthMiddleware::jsonResponse(['error' => 'Session not found.'], 404);
            exit;
        }

        if ((int)$session['teacher_id'] !== $userId && (int)$session['learner_id'] !== $userId) {
            AuthMiddleware::jsonResponse(['error' => 'Unauthorized: You are not a participant in this live session.'], 403);
            exit;
        }

        return $session;
    }

    /**
     * GET /api/v1/sessions/{id}/meeting-config
     */
    public static function getMeetingConfig(int $sessionId): void {
        $user = AuthMiddleware::requireAuth();
        $pdo = Database::getCoreConnection();
        $session = self::verifySessionAccess($pdo, $sessionId, (int)$user['id']);

        $isTeacher = ((int)$session['teacher_id'] === (int)$user['id']);

        AuthMiddleware::jsonResponse([
            'session_id' => $sessionId,
            'meeting_room_id' => $session['meeting_room_id'],
            'session_title' => $session['session_title'],
            'is_teacher' => $isTeacher,
            'user' => [
                'id' => (int)$user['id'],
                'name' => $user['full_name'],
                'role' => $isTeacher ? 'Instructor' : 'Learner'
            ],
            'partner' => [
                'id' => $isTeacher ? (int)$session['learner_id'] : (int)$session['teacher_id'],
                'name' => $isTeacher ? $session['learner_name'] : $session['teacher_name']
            ],
            'provider' => 'jitsi',
            'domain' => 'meet.jit.si',
            'room_name' => 'timecredit-' . $session['meeting_room_id']
        ]);
    }

    /**
     * GET /api/v1/sessions/{id}/whiteboard
     */
    public static function getWhiteboard(int $sessionId): void {
        $user = AuthMiddleware::requireAuth();
        $pdo = Database::getCoreConnection();
        self::verifySessionAccess($pdo, $sessionId, (int)$user['id']);

        $sinceId = (int)($_GET['since_id'] ?? 0);

        // Fetch latest snapshot to see if board was cleared
        $snapStmt = $pdo->prepare('
            SELECT id, version, created_at 
            FROM whiteboard_snapshots 
            WHERE session_id = :sid 
            ORDER BY id DESC LIMIT 1
        ');
        $snapStmt->execute(['sid' => $sessionId]);
        $latestSnapshot = $snapStmt->fetch();
        $snapshotTime = $latestSnapshot ? $latestSnapshot['created_at'] : '1970-01-01 00:00:00';

        // Fetch strokes created after latest clear
        if ($sinceId > 0) {
            $stmt = $pdo->prepare('
                SELECT id, stroke_id, user_id, tool, color, stroke_width, points, created_at
                FROM whiteboard_strokes
                WHERE session_id = :sid AND id > :since_id AND created_at >= :snap_time
                ORDER BY id ASC
            ');
            $stmt->execute(['sid' => $sessionId, 'since_id' => $sinceId, 'snap_time' => $snapshotTime]);
        } else {
            $stmt = $pdo->prepare('
                SELECT id, stroke_id, user_id, tool, color, stroke_width, points, created_at
                FROM whiteboard_strokes
                WHERE session_id = :sid AND created_at >= :snap_time
                ORDER BY id ASC
                LIMIT 500
            ');
            $stmt->execute(['sid' => $sessionId, 'snap_time' => $snapshotTime]);
        }

        $strokes = $stmt->fetchAll();
        $formatted = array_map(function ($s) {
            return [
                'id' => (int)$s['id'],
                'stroke_id' => $s['stroke_id'],
                'user_id' => (int)$s['user_id'],
                'tool' => $s['tool'],
                'color' => $s['color'],
                'stroke_width' => (int)$s['stroke_width'],
                'points' => is_string($s['points']) ? json_decode($s['points'], true) : $s['points'],
                'created_at' => $s['created_at']
            ];
        }, $strokes);

        AuthMiddleware::jsonResponse([
            'strokes' => $formatted,
            'snapshot_version' => $latestSnapshot ? (int)$latestSnapshot['version'] : 1
        ]);
    }

    /**
     * POST /api/v1/sessions/{id}/whiteboard/stroke
     */
    public static function addStroke(int $sessionId): void {
        $user = AuthMiddleware::requireAuth();
        $pdo = Database::getCoreConnection();
        self::verifySessionAccess($pdo, $sessionId, (int)$user['id']);

        $input = AuthMiddleware::getJsonInput();
        $strokeId = trim($input['stroke_id'] ?? ('stroke_' . bin2hex(random_bytes(6))));
        $tool = trim($input['tool'] ?? 'pen');
        $color = trim($input['color'] ?? '#0f172a');
        $strokeWidth = max(1, min(40, (int)($input['stroke_width'] ?? 3)));
        $points = $input['points'] ?? [];

        if (empty($points) || !is_array($points)) {
            AuthMiddleware::jsonResponse(['error' => 'Valid stroke coordinates array required.'], 422);
            return;
        }

        // Validate payload limit to prevent unbounded memory exhaustion
        if (count($points) > 2000) {
            $points = array_slice($points, 0, 2000);
        }

        $pointsJson = json_encode($points);
        if (strlen($pointsJson) > 100000) {
            AuthMiddleware::jsonResponse(['error' => 'Stroke payload exceeds maximum size limit.'], 413);
            return;
        }

        $insertedId = Database::insertAndGetId($pdo, '
            INSERT INTO whiteboard_strokes (session_id, user_id, stroke_id, tool, color, stroke_width, points)
            VALUES (:sid, :uid, :stroke_id, :tool, :color, :width, :points)
            ON CONFLICT (stroke_id) DO NOTHING
        ', [
            'sid' => $sessionId,
            'uid' => $user['id'],
            'stroke_id' => $strokeId,
            'tool' => in_array($tool, ['pen', 'eraser', 'line', 'rectangle', 'text']) ? $tool : 'pen',
            'color' => substr($color, 0, 30),
            'width' => $strokeWidth,
            'points' => $pointsJson
        ]);

        AuthMiddleware::jsonResponse([
            'success' => true,
            'id' => $insertedId,
            'stroke_id' => $strokeId
        ], 201);
    }

    /**
     * POST /api/v1/sessions/{id}/whiteboard/clear
     */
    public static function clearWhiteboard(int $sessionId): void {
        $user = AuthMiddleware::requireAuth();
        $pdo = Database::getCoreConnection();
        self::verifySessionAccess($pdo, $sessionId, (int)$user['id']);

        // Record a snapshot marking the clear event
        $stmt = $pdo->prepare('
            INSERT INTO whiteboard_snapshots (session_id, cleared_by, version)
            VALUES (:sid, :uid, (COALESCE((SELECT MAX(version) FROM whiteboard_snapshots WHERE session_id = :sid2), 0) + 1))
        ');
        $stmt->execute([
            'sid' => $sessionId,
            'uid' => $user['id'],
            'sid2' => $sessionId
        ]);

        AuthMiddleware::jsonResponse(['message' => 'Whiteboard cleared successfully.']);
    }

    /**
     * GET /api/v1/sessions/{id}/chat
     */
    public static function getChat(int $sessionId): void {
        $user = AuthMiddleware::requireAuth();
        $pdo = Database::getCoreConnection();
        self::verifySessionAccess($pdo, $sessionId, (int)$user['id']);

        $sinceId = (int)($_GET['since_id'] ?? 0);

        if ($sinceId > 0) {
            $stmt = $pdo->prepare('
                SELECT cm.id, cm.session_id, cm.sender_id, cm.message, cm.created_at,
                       u.full_name AS sender_name
                FROM chat_messages cm
                JOIN users u ON cm.sender_id = u.id
                WHERE cm.session_id = :sid AND cm.id > :since_id
                ORDER BY cm.created_at ASC
            ');
            $stmt->execute(['sid' => $sessionId, 'since_id' => $sinceId]);
        } else {
            $stmt = $pdo->prepare('
                SELECT cm.id, cm.session_id, cm.sender_id, cm.message, cm.created_at,
                       u.full_name AS sender_name
                FROM chat_messages cm
                JOIN users u ON cm.sender_id = u.id
                WHERE cm.session_id = :sid
                ORDER BY cm.created_at ASC
                LIMIT 100
            ');
            $stmt->execute(['sid' => $sessionId]);
        }

        AuthMiddleware::jsonResponse(['messages' => $stmt->fetchAll()]);
    }

    /**
     * POST /api/v1/sessions/{id}/chat
     */
    public static function sendChatMessage(int $sessionId): void {
        $user = AuthMiddleware::requireAuth();
        $pdo = Database::getCoreConnection();
        self::verifySessionAccess($pdo, $sessionId, (int)$user['id']);

        $input = AuthMiddleware::getJsonInput();
        $message = trim($input['message'] ?? '');

        if (empty($message)) {
            AuthMiddleware::jsonResponse(['error' => 'Message cannot be empty.'], 422);
            return;
        }

        if (strlen($message) > 1000) {
            AuthMiddleware::jsonResponse(['error' => 'Message exceeds 1000 character limit.'], 422);
            return;
        }

        $msgId = Database::insertAndGetId($pdo, '
            INSERT INTO chat_messages (session_id, sender_id, message)
            VALUES (:sid, :uid, :msg)
        ', [
            'sid' => $sessionId,
            'uid' => $user['id'],
            'msg' => $message
        ]);

        AuthMiddleware::jsonResponse([
            'id' => $msgId,
            'session_id' => $sessionId,
            'sender_id' => (int)$user['id'],
            'sender_name' => $user['full_name'],
            'message' => $message,
            'created_at' => date('Y-m-d H:i:s')
        ], 201);
    }
}
