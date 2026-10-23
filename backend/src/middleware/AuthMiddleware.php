<?php
declare(strict_types=1);

namespace TimeCredit\Middleware;

class AuthMiddleware {
    /**
     * Initialize secure session.
     */
    public static function startSession(): void {
        if (session_status() === PHP_SESSION_NONE) {
            $config = (require __DIR__ . '/../../config/database.php')['session'];
            session_set_cookie_params([
                'lifetime' => $config['lifetime'],
                'path' => '/',
                'domain' => '',
                'secure' => $config['cookie_secure'],
                'httponly' => $config['cookie_httponly'],
                'samesite' => $config['cookie_samesite'],
            ]);
            session_start();
        }
    }

    /**
     * Check if user is authenticated.
     */
    public static function requireAuth(): array {
        self::startSession();
        if (empty($_SESSION['user']) || empty($_SESSION['user']['id'])) {
            self::jsonResponse(['error' => 'Unauthorized: Please log in to continue.'], 401);
            exit;
        }
        return $_SESSION['user'];
    }

    /**
     * Check if authenticated user has Admin role.
     */
    public static function requireAdmin(): array {
        $user = self::requireAuth();
        if ($user['role'] !== 'admin') {
            self::jsonResponse(['error' => 'Forbidden: Administrator privileges required.'], 403);
            exit;
        }
        return $user;
    }

    /**
     * Parse incoming JSON request body.
     */
    public static function getJsonInput(): array {
        $raw = file_get_contents('php://input');
        if (empty($raw)) {
            return [];
        }
        $data = json_decode($raw, true);
        return is_array($data) ? $data : [];
    }

    /**
     * Send structured JSON response.
     */
    public static function jsonResponse(array $data, int $statusCode = 200): void {
        http_response_code($statusCode);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    }
}
