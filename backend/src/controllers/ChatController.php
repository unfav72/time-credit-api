<?php
declare(strict_types=1);

namespace TimeCredit\Controllers;

use PDO;
use TimeCredit\Middleware\AuthMiddleware;
use TimeCredit\Repositories\Database;

class ChatController {
    private static bool $schemaChecked = false;

    /**
     * Ensure database tables exist for WebRTC signaling, friendships, and direct messaging.
     */
    private static function ensureSchema(PDO $pdo): void {
        if (self::$schemaChecked) return;
        $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);

        try {
            if ($driver === 'pgsql') {
                $pdo->exec("
                    CREATE TABLE IF NOT EXISTS session_signals (
                        id SERIAL PRIMARY KEY,
                        session_id INT NOT NULL,
                        sender_id INT NOT NULL,
                        signal_type VARCHAR(50) NOT NULL,
                        payload TEXT NOT NULL,
                        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                    );
                    CREATE INDEX IF NOT EXISTS idx_signals_session ON session_signals(session_id, id);

                    CREATE TABLE IF NOT EXISTS friendships (
                        id SERIAL PRIMARY KEY,
                        user_id_1 INT NOT NULL,
                        user_id_2 INT NOT NULL,
                        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
                        action_user_id INT NOT NULL,
                        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        CONSTRAINT uq_friendship UNIQUE (user_id_1, user_id_2)
                    );
                    CREATE INDEX IF NOT EXISTS idx_friendships_users ON friendships(user_id_1, user_id_2);

                    CREATE TABLE IF NOT EXISTS direct_messages (
                        id SERIAL PRIMARY KEY,
                        sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        receiver_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        message TEXT NOT NULL,
                        is_read BOOLEAN NOT NULL DEFAULT FALSE,
                        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                    );
                    CREATE INDEX IF NOT EXISTS idx_dm_thread ON direct_messages(sender_id, receiver_id, id);
                ");
            } else {
                $pdo->exec("
                    CREATE TABLE IF NOT EXISTS session_signals (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        session_id INT NOT NULL,
                        sender_id INT NOT NULL,
                        signal_type VARCHAR(50) NOT NULL,
                        payload TEXT NOT NULL,
                        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        INDEX idx_signals_session (session_id, id)
                    ) ENGINE=InnoDB;

                    CREATE TABLE IF NOT EXISTS friendships (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        user_id_1 INT NOT NULL,
                        user_id_2 INT NOT NULL,
                        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
                        action_user_id INT NOT NULL,
                        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        UNIQUE KEY uq_friendship (user_id_1, user_id_2)
                    ) ENGINE=InnoDB;

                    CREATE TABLE IF NOT EXISTS direct_messages (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        sender_id INT NOT NULL,
                        receiver_id INT NOT NULL,
                        message TEXT NOT NULL,
                        is_read BOOLEAN NOT NULL DEFAULT FALSE,
                        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        INDEX idx_dm_thread (sender_id, receiver_id, id)
                    ) ENGINE=InnoDB;
                ");
            }
            self::$schemaChecked = true;
        } catch (\Throwable $e) {
            // Non-fatal if tables already exist
            self::$schemaChecked = true;
        }
    }

    // =========================================================================
    // 1. WEBRTC P2P SIGNALING (OFFER / ANSWER / ICE CANDIDATES)
    // =========================================================================

    /**
     * POST /api/v1/sessions/{id}/signal
     */
    public static function sendSignal(int $sessionId): void {
        $user = AuthMiddleware::requireAuth();
        $pdo = Database::getCoreConnection();
        self::ensureSchema($pdo);

        $input = AuthMiddleware::getJsonInput();
        $type = trim($input['signal_type'] ?? $input['type'] ?? '');
        $rawPayload = $input['payload'] ?? null;
        $payload = is_string($rawPayload) ? $rawPayload : json_encode($rawPayload ?? []);

        if (empty($type) || empty($payload)) {
            AuthMiddleware::jsonResponse(['error' => 'Signal type and payload are required.'], 422);
            return;
        }

        $stmt = $pdo->prepare('
            INSERT INTO session_signals (session_id, sender_id, signal_type, payload)
            VALUES (:sid, :uid, :type, :payload)
        ');
        $stmt->execute([
            'sid' => $sessionId,
            'uid' => $user['id'],
            'type' => $type,
            'payload' => $payload
        ]);

        AuthMiddleware::jsonResponse(['message' => 'Signal delivered successfully.']);
    }

    /**
     * GET /api/v1/sessions/{id}/signal?since_id=...
     */
    public static function getSignals(int $sessionId): void {
        $user = AuthMiddleware::requireAuth();
        $pdo = Database::getCoreConnection();
        self::ensureSchema($pdo);

        $sinceId = (int)($_GET['since_id'] ?? 0);

        // Periodically purge old signals older than 2 hours to keep the table clean
        try {
            $pdo->exec("DELETE FROM session_signals WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '2 hours'");
        } catch (\Throwable $t) {}

        // Retrieve signals sent by the OTHER peer (sender_id != me)
        $stmt = $pdo->prepare('
            SELECT id, session_id, sender_id, signal_type, payload, created_at
            FROM session_signals
            WHERE session_id = :sid AND sender_id != :uid AND id > :since_id
            ORDER BY id ASC
            LIMIT 150
        ');
        $stmt->execute([
            'sid' => $sessionId,
            'uid' => $user['id'],
            'since_id' => $sinceId
        ]);

        $signals = $stmt->fetchAll();
        AuthMiddleware::jsonResponse(['signals' => $signals]);
    }

    // =========================================================================
    // 2. FRIENDSHIPS & FRIEND REQUESTS
    // =========================================================================

    /**
     * GET /api/v1/friends
     */
    public static function getFriends(): void {
        $user = AuthMiddleware::requireAuth();
        $pdo = Database::getCoreConnection();
        self::ensureSchema($pdo);
        $myId = (int)$user['id'];

        // 1. Accepted Friends
        $fStmt = $pdo->prepare("
            SELECT f.id AS friendship_id, f.status, f.created_at AS friends_since,
                   CASE WHEN f.user_id_1 = :uid1 THEN u2.id ELSE u1.id END AS user_id,
                   CASE WHEN f.user_id_1 = :uid2 THEN u2.full_name ELSE u1.full_name END AS full_name,
                   CASE WHEN f.user_id_1 = :uid3 THEN u2.email ELSE u1.email END AS email,
                   CASE WHEN f.user_id_1 = :uid4 THEN u2.bio ELSE u1.bio END AS bio,
                   CASE WHEN f.user_id_1 = :uid5 THEN u2.role ELSE u1.role END AS role
            FROM friendships f
            JOIN users u1 ON f.user_id_1 = u1.id
            JOIN users u2 ON f.user_id_2 = u2.id
            WHERE (f.user_id_1 = :my_id OR f.user_id_2 = :my_id2)
              AND f.status = 'ACCEPTED'
            ORDER BY full_name ASC
        ");
        $fStmt->execute([
            'uid1' => $myId, 'uid2' => $myId, 'uid3' => $myId, 'uid4' => $myId, 'uid5' => $myId,
            'my_id' => $myId, 'my_id2' => $myId
        ]);
        $rawFriends = $fStmt->fetchAll();
        $friends = array_map(function($f) {
            return [
                'friendship_id' => (int)$f['friendship_id'],
                'user_id' => (int)$f['user_id'],
                'full_name' => $f['full_name'],
                'email' => $f['email'],
                'bio' => $f['bio'] ?? '',
                'role' => $f['role'] ?? 'member',
                'status' => $f['status'] ?? 'ACCEPTED',
                'friends_since' => $f['friends_since'] ?? date('c'),
            ];
        }, $rawFriends);

        // 2. Pending Requests Received (I need to accept/decline)
        $rStmt = $pdo->prepare("
            SELECT f.id AS request_id, f.created_at,
                   sender.id AS sender_id, sender.full_name AS sender_name, sender.email AS sender_email, sender.bio AS sender_bio
            FROM friendships f
            JOIN users sender ON f.action_user_id = sender.id
            WHERE (f.user_id_1 = :my_id OR f.user_id_2 = :my_id2)
              AND f.status = 'PENDING'
              AND f.action_user_id != :my_id3
            ORDER BY f.created_at DESC
        ");
        $rStmt->execute([
            'my_id' => $myId,
            'my_id2' => $myId,
            'my_id3' => $myId
        ]);
        $rawPendingReceived = $rStmt->fetchAll();
        $pendingReceived = array_map(function($r) {
            return [
                'request_id' => (int)$r['request_id'],
                'sender_id' => (int)$r['sender_id'],
                'sender_name' => $r['sender_name'],
                'sender_email' => $r['sender_email'],
                'sender_bio' => $r['sender_bio'] ?? '',
                'created_at' => $r['created_at'] ?? date('c'),
            ];
        }, $rawPendingReceived);

        // 3. Pending Requests Sent (waiting for them)
        $sStmt = $pdo->prepare("
            SELECT f.id AS request_id, f.created_at,
                   CASE WHEN f.user_id_1 = :uid1 THEN u2.id ELSE u1.id END AS receiver_id,
                   CASE WHEN f.user_id_1 = :uid2 THEN u2.full_name ELSE u1.full_name END AS receiver_name,
                   CASE WHEN f.user_id_1 = :uid3 THEN u2.email ELSE u1.email END AS receiver_email
            FROM friendships f
            JOIN users u1 ON f.user_id_1 = u1.id
            JOIN users u2 ON f.user_id_2 = u2.id
            WHERE f.action_user_id = :my_id
              AND f.status = 'PENDING'
            ORDER BY f.created_at DESC
        ");
        $sStmt->execute([
            'uid1' => $myId, 'uid2' => $myId, 'uid3' => $myId,
            'my_id' => $myId
        ]);
        $rawPendingSent = $sStmt->fetchAll();
        $pendingSent = array_map(function($s) {
            return [
                'request_id' => (int)$s['request_id'],
                'receiver_id' => (int)$s['receiver_id'],
                'receiver_name' => $s['receiver_name'],
                'receiver_email' => $s['receiver_email'],
                'created_at' => $s['created_at'] ?? date('c'),
            ];
        }, $rawPendingSent);

        AuthMiddleware::jsonResponse([
            'friends' => $friends,
            'pending_received' => $pendingReceived,
            'pending_sent' => $pendingSent
        ]);
    }

    /**
     * POST /api/v1/friends/request
     */
    public static function sendFriendRequest(): void {
        $user = AuthMiddleware::requireAuth();
        $pdo = Database::getCoreConnection();
        self::ensureSchema($pdo);

        $input = AuthMiddleware::getJsonInput();
        $targetUserId = (int)($input['target_user_id'] ?? 0);
        $targetEmail = strtolower(trim($input['target_email'] ?? ''));

        if ($targetUserId <= 0 && !empty($targetEmail)) {
            $fStmt = $pdo->prepare('SELECT id FROM users WHERE LOWER(email) = :email LIMIT 1');
            $fStmt->execute(['email' => $targetEmail]);
            $found = $fStmt->fetchColumn();
            if ($found) {
                $targetUserId = (int)$found;
            }
        }

        if ($targetUserId <= 0) {
            AuthMiddleware::jsonResponse(['error' => 'Target user not found.'], 404);
            return;
        }

        $myId = (int)$user['id'];
        if ($targetUserId === $myId) {
            AuthMiddleware::jsonResponse(['error' => 'You cannot send a friend request to yourself.'], 400);
            return;
        }

        $u1 = min($myId, $targetUserId);
        $u2 = max($myId, $targetUserId);

        // Check existing friendship record
        $check = $pdo->prepare('SELECT * FROM friendships WHERE user_id_1 = :u1 AND user_id_2 = :u2');
        $check->execute(['u1' => $u1, 'u2' => $u2]);
        $existing = $check->fetch();

        if ($existing) {
            if ($existing['status'] === 'ACCEPTED') {
                AuthMiddleware::jsonResponse(['message' => 'You are already friends with this member.']);
                return;
            }
            if ($existing['status'] === 'PENDING') {
                AuthMiddleware::jsonResponse(['message' => 'A friend request is already pending between you.']);
                return;
            }
            // Update to PENDING
            $upd = $pdo->prepare("UPDATE friendships SET status = 'PENDING', action_user_id = :aid, updated_at = NOW() WHERE id = :id");
            $upd->execute(['aid' => $myId, 'id' => $existing['id']]);
        } else {
            $ins = $pdo->prepare("
                INSERT INTO friendships (user_id_1, user_id_2, status, action_user_id, created_at, updated_at)
                VALUES (:u1, :u2, 'PENDING', :aid, NOW(), NOW())
            ");
            $ins->execute(['u1' => $u1, 'u2' => $u2, 'aid' => $myId]);
        }

        // Send in-app notification to target user
        try {
            $notif = $pdo->prepare('INSERT INTO notifications (user_id, title, message) VALUES (:uid, :title, :msg)');
            $notif->execute([
                'uid' => $targetUserId,
                'title' => 'New Friend Request',
                'msg' => $user['full_name'] . ' sent you a friend request on TimeCredit Live!'
            ]);
        } catch (\Throwable $nErr) {}

        AuthMiddleware::jsonResponse(['message' => 'Friend request sent successfully!'], 201);
    }

    /**
     * POST /api/v1/friends/{id}/accept
     */
    public static function acceptFriendRequest(int $friendshipId): void {
        $user = AuthMiddleware::requireAuth();
        $pdo = Database::getCoreConnection();
        self::ensureSchema($pdo);
        $myId = (int)$user['id'];

        $stmt = $pdo->prepare('SELECT * FROM friendships WHERE id = :id');
        $stmt->execute(['id' => $friendshipId]);
        $friendship = $stmt->fetch();

        if (!$friendship) {
            AuthMiddleware::jsonResponse(['error' => 'Friend request not found.'], 404);
            return;
        }

        if ((int)$friendship['user_id_1'] !== $myId && (int)$friendship['user_id_2'] !== $myId) {
            AuthMiddleware::jsonResponse(['error' => 'Unauthorized.'], 403);
            return;
        }

        $upd = $pdo->prepare("UPDATE friendships SET status = 'ACCEPTED', action_user_id = :aid, updated_at = NOW() WHERE id = :id");
        $upd->execute(['aid' => $myId, 'id' => $friendshipId]);

        $otherId = ((int)$friendship['user_id_1'] === $myId) ? (int)$friendship['user_id_2'] : (int)$friendship['user_id_1'];
        try {
            $notif = $pdo->prepare('INSERT INTO notifications (user_id, title, message) VALUES (:uid, :title, :msg)');
            $notif->execute([
                'uid' => $otherId,
                'title' => 'Friend Request Accepted',
                'msg' => $user['full_name'] . ' accepted your friend request! You can now chat in real-time.'
            ]);
        } catch (\Throwable $nErr) {}

        $otherStmt = $pdo->prepare('SELECT id, full_name, email, bio, role FROM users WHERE id = :id');
        $otherStmt->execute(['id' => $otherId]);
        $otherUser = $otherStmt->fetch();

        AuthMiddleware::jsonResponse([
            'message' => 'Friend request accepted! You are now connected.',
            'friend' => $otherUser ? [
                'id' => (int)$otherUser['id'],
                'full_name' => $otherUser['full_name'],
                'email' => $otherUser['email'],
                'bio' => $otherUser['bio'] ?? '',
                'role' => $otherUser['role'] ?? 'member',
                'is_friend' => true
            ] : null
        ]);
    }

    /**
     * POST /api/v1/friends/{id}/decline
     */
    public static function declineFriendRequest(int $friendshipId): void {
        $user = AuthMiddleware::requireAuth();
        $pdo = Database::getCoreConnection();
        self::ensureSchema($pdo);
        $myId = (int)$user['id'];

        $stmt = $pdo->prepare('DELETE FROM friendships WHERE id = :id AND (user_id_1 = :uid1 OR user_id_2 = :uid2)');
        $stmt->execute(['id' => $friendshipId, 'uid1' => $myId, 'uid2' => $myId]);

        AuthMiddleware::jsonResponse(['message' => 'Friend request declined.']);
    }

    /**
     * GET /api/v1/users/directory?q=...
     */
    public static function searchUsers(): void {
        $user = AuthMiddleware::requireAuth();
        $pdo = Database::getCoreConnection();
        self::ensureSchema($pdo);
        $myId = (int)$user['id'];
        $query = trim($_GET['q'] ?? '');

        $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
        $likeOp = ($driver === 'pgsql') ? 'ILIKE' : 'LIKE';
        $whereSql = "u.id != :my_id";
        $params = [
            'my_id' => $myId,
            'uid1' => $myId, 'uid2' => $myId,
            'uid3' => $myId, 'uid4' => $myId,
            'uid5' => $myId, 'uid6' => $myId,
            'my_id_action' => $myId
        ];

        if (!empty($query)) {
            $words = preg_split('/\s+/', $query);
            $wordClauses = [];
            foreach ($words as $idx => $w) {
                if (empty($w)) continue;
                $pName = "qw_{$idx}";
                $wordClauses[] = "(u.full_name {$likeOp} :{$pName} OR u.email {$likeOp} :{$pName} OR COALESCE(u.bio, '') {$likeOp} :{$pName})";
                $params[$pName] = "%{$w}%";
            }
            if (!empty($wordClauses)) {
                $whereSql .= " AND (" . implode(" AND ", $wordClauses) . ")";
            }
        }

        $stmt = $pdo->prepare("
            SELECT u.id, u.full_name, u.email, u.bio, u.role,
                   EXISTS(
                       SELECT 1 FROM friendships f 
                       WHERE ((f.user_id_1 = :uid1 AND f.user_id_2 = u.id) OR (f.user_id_1 = u.id AND f.user_id_2 = :uid2))
                         AND f.status = 'ACCEPTED'
                   ) AS is_friend,
                   (
                       SELECT f.status FROM friendships f 
                       WHERE ((f.user_id_1 = :uid3 AND f.user_id_2 = u.id) OR (f.user_id_1 = u.id AND f.user_id_2 = :uid4))
                       LIMIT 1
                   ) AS friendship_status,
                   EXISTS(
                       SELECT 1 FROM friendships f 
                       WHERE ((f.user_id_1 = :uid5 AND f.user_id_2 = u.id) OR (f.user_id_1 = u.id AND f.user_id_2 = :uid6))
                         AND f.status = 'PENDING' AND f.action_user_id = :my_id_action
                   ) AS is_pending_sent
            FROM users u
            WHERE {$whereSql}
            ORDER BY is_friend DESC, u.full_name ASC 
            LIMIT 40
        ");
        $stmt->execute($params);

        $rawUsers = $stmt->fetchAll();
        $users = array_map(function($u) {
            return [
                'id' => (int)$u['id'],
                'full_name' => $u['full_name'],
                'email' => $u['email'],
                'bio' => $u['bio'] ?? '',
                'role' => $u['role'] ?? 'member',
                'is_friend' => !empty($u['is_friend']) && $u['is_friend'] !== '0' && $u['is_friend'] !== false,
                'friendship_status' => $u['friendship_status'] ?? null,
                'is_pending_sent' => !empty($u['is_pending_sent']) && $u['is_pending_sent'] !== '0' && $u['is_pending_sent'] !== false,
            ];
        }, $rawUsers);

        AuthMiddleware::jsonResponse(['users' => $users]);
    }

    // =========================================================================
    // 3. DIRECT MESSAGING (PEER-TO-PEER CHAT)
    // =========================================================================

    /**
     * GET /api/v1/messages/conversations
     */
    public static function getConversations(): void {
        $user = AuthMiddleware::requireAuth();
        $pdo = Database::getCoreConnection();
        self::ensureSchema($pdo);
        $myId = (int)$user['id'];

        // Get all unique peers that current user has exchanged messages with OR are accepted friends with
        $stmt = $pdo->prepare("
            SELECT u.id AS peer_id, u.full_name, u.email, u.bio, u.role,
                   (
                       SELECT dm.message 
                       FROM direct_messages dm 
                       WHERE (dm.sender_id = :uid1 AND dm.receiver_id = u.id) 
                          OR (dm.sender_id = u.id AND dm.receiver_id = :uid2)
                       ORDER BY dm.id DESC 
                       LIMIT 1
                   ) AS last_message,
                   (
                       SELECT dm.created_at 
                       FROM direct_messages dm 
                       WHERE (dm.sender_id = :uid3 AND dm.receiver_id = u.id) 
                          OR (dm.sender_id = u.id AND dm.receiver_id = :uid4)
                       ORDER BY dm.id DESC 
                       LIMIT 1
                   ) AS last_message_time,
                   (
                       SELECT COUNT(*) 
                       FROM direct_messages dm 
                       WHERE dm.sender_id = u.id AND dm.receiver_id = :uid5 AND dm.is_read = FALSE
                   ) AS unread_count,
                   EXISTS(
                       SELECT 1 FROM friendships f 
                       WHERE ((f.user_id_1 = :uid6 AND f.user_id_2 = u.id) OR (f.user_id_1 = u.id AND f.user_id_2 = :uid7))
                         AND f.status = 'ACCEPTED'
                   ) AS is_friend
            FROM users u
            WHERE u.id != :my_id
              AND (
                  EXISTS(
                      SELECT 1 FROM direct_messages dm 
                      WHERE (dm.sender_id = :uid8 AND dm.receiver_id = u.id) 
                         OR (dm.sender_id = u.id AND dm.receiver_id = :uid9)
                  )
                  OR EXISTS(
                      SELECT 1 FROM friendships f 
                      WHERE ((f.user_id_1 = :uid10 AND f.user_id_2 = u.id) OR (f.user_id_1 = u.id AND f.user_id_2 = :uid11))
                        AND f.status = 'ACCEPTED'
                  )
              )
            ORDER BY last_message_time DESC NULLS LAST, u.full_name ASC
        ");
        $stmt->execute([
            'uid1' => $myId, 'uid2' => $myId, 'uid3' => $myId, 'uid4' => $myId, 'uid5' => $myId,
            'uid6' => $myId, 'uid7' => $myId, 'my_id' => $myId, 'uid8' => $myId, 'uid9' => $myId,
            'uid10' => $myId, 'uid11' => $myId
        ]);

        $rawConversations = $stmt->fetchAll();
        $conversations = array_map(function($c) {
            return [
                'peer_id' => (int)$c['peer_id'],
                'full_name' => $c['full_name'],
                'email' => $c['email'],
                'bio' => $c['bio'] ?? '',
                'role' => $c['role'] ?? 'member',
                'last_message' => $c['last_message'] ?? null,
                'last_message_time' => $c['last_message_time'] ?? null,
                'unread_count' => (int)($c['unread_count'] ?? 0),
                'is_friend' => !empty($c['is_friend']) && $c['is_friend'] !== '0' && $c['is_friend'] !== false,
            ];
        }, $rawConversations);

        AuthMiddleware::jsonResponse(['conversations' => $conversations]);
    }

    /**
     * GET /api/v1/messages/{peerId}
     */
    public static function getDirectMessages(int $peerId): void {
        $user = AuthMiddleware::requireAuth();
        $pdo = Database::getCoreConnection();
        self::ensureSchema($pdo);
        $myId = (int)$user['id'];

        $sinceId = (int)($_GET['since_id'] ?? 0);

        // Mark unread messages from peer as read
        $upd = $pdo->prepare('UPDATE direct_messages SET is_read = TRUE WHERE sender_id = :peer_id AND receiver_id = :my_id AND is_read = FALSE');
        $upd->execute(['peer_id' => $peerId, 'my_id' => $myId]);

        if ($sinceId > 0) {
            $stmt = $pdo->prepare('
                SELECT dm.id, dm.sender_id, dm.receiver_id, dm.message, dm.is_read, dm.created_at,
                       sender.full_name AS sender_name
                FROM direct_messages dm
                JOIN users sender ON dm.sender_id = sender.id
                WHERE ((dm.sender_id = :my_id AND dm.receiver_id = :peer_id) OR (dm.sender_id = :peer_id2 AND dm.receiver_id = :my_id2))
                  AND dm.id > :since_id
                ORDER BY dm.id ASC
            ');
            $stmt->execute([
                'my_id' => $myId, 'peer_id' => $peerId,
                'peer_id2' => $peerId, 'my_id2' => $myId,
                'since_id' => $sinceId
            ]);
        } else {
            $stmt = $pdo->prepare('
                SELECT dm.id, dm.sender_id, dm.receiver_id, dm.message, dm.is_read, dm.created_at,
                       sender.full_name AS sender_name
                FROM direct_messages dm
                JOIN users sender ON dm.sender_id = sender.id
                WHERE ((dm.sender_id = :my_id AND dm.receiver_id = :peer_id) OR (dm.sender_id = :peer_id2 AND dm.receiver_id = :my_id2))
                ORDER BY dm.id ASC
                LIMIT 100
            ');
            $stmt->execute([
                'my_id' => $myId, 'peer_id' => $peerId,
                'peer_id2' => $peerId, 'my_id2' => $myId
            ]);
        }

        $messages = $stmt->fetchAll();
        AuthMiddleware::jsonResponse(['messages' => $messages]);
    }

    /**
     * POST /api/v1/messages/{peerId}
     */
    public static function sendDirectMessage(int $peerId): void {
        $user = AuthMiddleware::requireAuth();
        $pdo = Database::getCoreConnection();
        self::ensureSchema($pdo);
        $myId = (int)$user['id'];

        if ($peerId === $myId) {
            AuthMiddleware::jsonResponse(['error' => 'You cannot message yourself.'], 400);
            return;
        }

        $input = AuthMiddleware::getJsonInput();
        $message = trim($input['message'] ?? '');

        if (empty($message)) {
            AuthMiddleware::jsonResponse(['error' => 'Message text cannot be empty.'], 422);
            return;
        }

        $msgId = Database::insertAndGetId($pdo, '
            INSERT INTO direct_messages (sender_id, receiver_id, message)
            VALUES (:sid, :rid, :msg)
        ', [
            'sid' => $myId,
            'rid' => $peerId,
            'msg' => $message
        ]);

        // Send in-app notification to receiver
        try {
            $notif = $pdo->prepare('INSERT INTO notifications (user_id, title, message) VALUES (:uid, :title, :msg)');
            $notif->execute([
                'uid' => $peerId,
                'title' => 'New Message from ' . $user['full_name'],
                'msg' => mb_strimwidth($message, 0, 80, '...')
            ]);
        } catch (\Throwable $nErr) {}

        AuthMiddleware::jsonResponse([
            'id' => $msgId,
            'sender_id' => $myId,
            'receiver_id' => $peerId,
            'sender_name' => $user['full_name'],
            'message' => $message,
            'created_at' => date('Y-m-d H:i:s'),
            'is_read' => false
        ], 201);
    }
}
