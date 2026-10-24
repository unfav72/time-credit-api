<?php
declare(strict_types=1);

namespace TimeCredit\Middleware;

use TimeCredit\Repositories\Database;

class AuthMiddleware {
    private static function getSecret(): string {
        return getenv('SESSION_SECRET') ?: 'c29tZXJhbmRvbXNlY3JldGtleWZvcnRpbWVjcmVkaXRsaXZlMTIzNDU2Nzg=';
    }

    /**
     * Generate a signed cryptographic token for cross-origin Bearer authorization.
     */
    public static function generateToken(array $user): string {
        $secret = self::getSecret();
        $payload = base64_encode(json_encode([
            'id' => (int)$user['id'],
            'email' => $user['email'],
            'role' => $user['role'] ?? 'member',
            'exp' => time() + (86400 * 14) // 14 days expiration
        ]));
        $signature = hash_hmac('sha256', $payload, $secret);
        return $payload . '.' . $signature;
    }

    /**
     * Cryptographically verify a token signature and return the payload claims without a database query.
     */
    public static function decodeTokenPayload(string $token): ?array {
        $parts = explode('.', $token);
        if (count($parts) !== 2) {
            return null;
        }

        [$payloadB64, $signature] = $parts;
        $secret = self::getSecret();
        $expectedSig = hash_hmac('sha256', $payloadB64, $secret);

        if (!hash_equals($expectedSig, $signature)) {
            return null;
        }

        $decoded = json_decode(base64_decode($payloadB64), true);
        if (!$decoded || !isset($decoded['id'], $decoded['exp'])) {
            return null;
        }

        if ($decoded['exp'] < time()) {
            return null; // Expired
        }

        return $decoded;
    }

    /**
     * Verify a signed token and retrieve the fresh user record from PostgreSQL.
     */
    public static function verifyToken(string $token): ?array {
        $decoded = self::decodeTokenPayload($token);
        if ($decoded === null) {
            return null;
        }

        try {
            $pdo = Database::getCoreConnection();
            $stmt = $pdo->prepare('
                SELECT u.id, u.full_name, u.email, u.role, u.status, u.bio,
                       COALESCE(ca.balance, 0.00) AS balance
                FROM users u
                LEFT JOIN credit_accounts ca ON u.id = ca.user_id
                WHERE u.id = :id AND u.status = \'active\'
                LIMIT 1
            ');
            $stmt->execute(['id' => (int)$decoded['id']]);
            $user = $stmt->fetch();
            if ($user) {
                return [
                    'id' => (int)$user['id'],
                    'full_name' => $user['full_name'],
                    'email' => $user['email'],
                    'role' => $user['role'],
                    'balance' => (float)$user['balance'],
                    'bio' => $user['bio']
                ];
            }
        } catch (\Throwable $e) {
            return null;
        }

        return null;
    }

    /**
     * Initialize secure session with cross-origin cookie support.
     */
    public static function startSession(): void {
        if (session_status() === PHP_SESSION_NONE) {
            $isHttps = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ||
                       (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');

            $config = (require __DIR__ . '/../../config/database.php')['session'];
            session_set_cookie_params([
                'lifetime' => $config['lifetime'] ?? 86400 * 7,
                'path' => '/',
                'domain' => '',
                'secure' => $isHttps,
                'httponly' => true,
                'samesite' => $isHttps ? 'None' : 'Lax',
            ]);
            session_start();
        }
    }

    /**
     * Check if user is authenticated via Session Cookie or Authorization Bearer header.
     */
    public static function requireAuth(): array {
        self::startSession();

        // 1. Check Session Cookie
        if (!empty($_SESSION['user']) && !empty($_SESSION['user']['id'])) {
            return $_SESSION['user'];
        }

        // 2. Check Authorization Header (Bearer token)
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
        if (empty($authHeader) && function_exists('getallheaders')) {
            $headers = getallheaders();
            $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
        }

        if (!empty($authHeader) && preg_match('/Bearer\s+(\S+)/i', $authHeader, $matches)) {
            $user = self::verifyToken($matches[1]);
            if ($user) {
                $_SESSION['user'] = $user;
                return $user;
            }
        }

        self::jsonResponse(['error' => 'Unauthorized: Please log in to continue.'], 401);
        exit;
    }

    /**
     * Optional authentication check without halting request.
     */
    public static function optionalAuth(): ?array {
        self::startSession();
        if (!empty($_SESSION['user']) && !empty($_SESSION['user']['id'])) {
            return $_SESSION['user'];
        }

        $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
        if (empty($authHeader) && function_exists('getallheaders')) {
            $headers = getallheaders();
            $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
        }

        if (!empty($authHeader) && preg_match('/Bearer\s+(\S+)/i', $authHeader, $matches)) {
            return self::verifyToken($matches[1]);
        }

        return null;
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
