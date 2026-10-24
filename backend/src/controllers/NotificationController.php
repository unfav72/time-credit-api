<?php
declare(strict_types=1);

namespace TimeCredit\Controllers;

use PDO;
use TimeCredit\Middleware\AuthMiddleware;
use TimeCredit\Repositories\Database;

class NotificationController {
    /**
     * GET /api/v1/notifications
     * Retrieve all in-app notifications for authenticated user.
     */
    public static function index(): void {
        $user = AuthMiddleware::requireAuth();
        $pdo = Database::getCoreConnection();

        $stmt = $pdo->prepare('
            SELECT id, title, message, notification_type, action_url, read_at, created_at
            FROM notifications
            WHERE user_id = :uid
            ORDER BY created_at DESC
            LIMIT 50
        ');
        $stmt->execute(['uid' => $user['id']]);
        $notifications = $stmt->fetchAll();

        // Calculate unread count
        $unreadStmt = $pdo->prepare('SELECT COUNT(*) FROM notifications WHERE user_id = :uid AND read_at IS NULL');
        $unreadStmt->execute(['uid' => $user['id']]);
        $unreadCount = (int)$unreadStmt->fetchColumn();

        AuthMiddleware::jsonResponse([
            'notifications' => $notifications,
            'unread_count' => $unreadCount
        ]);
    }

    /**
     * POST /api/v1/notifications/{id}/read
     */
    public static function markAsRead(int $id): void {
        $user = AuthMiddleware::requireAuth();
        $pdo = Database::getCoreConnection();

        $stmt = $pdo->prepare('UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE id = :id AND user_id = :uid');
        $stmt->execute(['id' => $id, 'uid' => $user['id']]);

        AuthMiddleware::jsonResponse(['message' => 'Notification marked as read.']);
    }

    /**
     * POST /api/v1/notifications/read-all
     */
    public static function markAllAsRead(): void {
        $user = AuthMiddleware::requireAuth();
        $pdo = Database::getCoreConnection();

        $stmt = $pdo->prepare('UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = :uid AND read_at IS NULL');
        $stmt->execute(['uid' => $user['id']]);

        AuthMiddleware::jsonResponse(['message' => 'All notifications marked as read.']);
    }

    /**
     * POST /api/v1/push/subscribe
     * Save browser Web Push subscription for authenticated user.
     */
    public static function subscribePush(): void {
        $user = AuthMiddleware::requireAuth();
        $input = AuthMiddleware::getJsonInput();

        $endpoint = trim($input['endpoint'] ?? '');
        $p256dh = trim($input['keys']['p256dh'] ?? ($input['p256dh'] ?? ''));
        $auth = trim($input['keys']['auth'] ?? ($input['auth'] ?? ''));
        $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? null;

        if (empty($endpoint) || empty($p256dh) || empty($auth)) {
            AuthMiddleware::jsonResponse(['error' => 'Valid push subscription endpoint, p256dh, and auth keys are required.'], 422);
            return;
        }

        $pdo = Database::getCoreConnection();
        $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);

        if ($driver === 'pgsql' || $driver === 'sqlite') {
            $stmt = $pdo->prepare('
                INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, updated_at)
                VALUES (:uid, :ep, :p256, :auth, :ua, CURRENT_TIMESTAMP)
                ON CONFLICT (endpoint) DO UPDATE
                SET user_id = EXCLUDED.user_id,
                    p256dh = EXCLUDED.p256dh,
                    auth = EXCLUDED.auth,
                    updated_at = CURRENT_TIMESTAMP
            ');
        } else {
            $stmt = $pdo->prepare('
                INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, updated_at)
                VALUES (:uid, :ep, :p256, :auth, :ua, CURRENT_TIMESTAMP)
                ON DUPLICATE KEY UPDATE
                    user_id = VALUES(user_id),
                    p256dh = VALUES(p256dh),
                    auth = VALUES(auth),
                    updated_at = CURRENT_TIMESTAMP
            ');
        }

        $stmt->execute([
            'uid' => $user['id'],
            'ep' => $endpoint,
            'p256' => $p256dh,
            'auth' => $auth,
            'ua' => $userAgent
        ]);

        AuthMiddleware::jsonResponse(['message' => 'Web push subscription registered successfully.']);
    }

    /**
     * DELETE /api/v1/push/subscribe
     */
    public static function unsubscribePush(): void {
        $user = AuthMiddleware::requireAuth();
        $input = AuthMiddleware::getJsonInput();
        $endpoint = trim($input['endpoint'] ?? '');

        $pdo = Database::getCoreConnection();
        if (!empty($endpoint)) {
            $stmt = $pdo->prepare('DELETE FROM push_subscriptions WHERE endpoint = :ep AND user_id = :uid');
            $stmt->execute(['ep' => $endpoint, 'uid' => $user['id']]);
        } else {
            $stmt = $pdo->prepare('DELETE FROM push_subscriptions WHERE user_id = :uid');
            $stmt->execute(['uid' => $user['id']]);
        }

        AuthMiddleware::jsonResponse(['message' => 'Web push subscription removed.']);
    }

    /**
     * GET /api/v1/push/public-key
     */
    public static function getPublicKey(): void {
        // Return VAPID Public Key (or test mock public key if not configured)
        $key = getenv('VAPID_PUBLIC_KEY') ?: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
        AuthMiddleware::jsonResponse(['public_key' => $key]);
    }
}
