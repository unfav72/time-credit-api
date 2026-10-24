<?php
declare(strict_types=1);

namespace TimeCredit\Controllers;

use PDO;
use TimeCredit\Middleware\AuthMiddleware;
use TimeCredit\Repositories\Database;

class AuthController {
    /**
     * POST /api/v1/auth/register
     */
    public static function register(): void {
        AuthMiddleware::startSession();
        $input = AuthMiddleware::getJsonInput();

        $fullName = trim($input['full_name'] ?? '');
        $email = strtolower(trim($input['email'] ?? ''));
        $password = $input['password'] ?? '';
        $confirmPassword = $input['confirm_password'] ?? '';
        $bio = trim($input['bio'] ?? '');

        // Validation
        if (empty($fullName) || empty($email) || empty($password)) {
            AuthMiddleware::jsonResponse(['error' => 'Full name, email, and password are required.'], 422);
            return;
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            AuthMiddleware::jsonResponse(['error' => 'Please provide a valid email address.'], 422);
            return;
        }

        if (strlen($password) < 8) {
            AuthMiddleware::jsonResponse(['error' => 'Password must be at least 8 characters long.'], 422);
            return;
        }

        if ($password !== $confirmPassword) {
            AuthMiddleware::jsonResponse(['error' => 'Password and confirmation password do not match.'], 422);
            return;
        }

        // Hash password securely with PHP bcrypt
        $passwordHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]);

        $pdo = Database::getCoreConnection();

        // Safety: Ensure clean transaction state
        try {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
        } catch (\Throwable $e) {}

        $step = 'init';
        try {
            $step = 'check_email';
            $stmt = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
            $stmt->execute(['email' => $email]);
            if ($stmt->fetch()) {
                AuthMiddleware::jsonResponse(['error' => 'An account with this email address already exists.'], 409);
                return;
            }

            $step = 'before_txn';
            $pdo->beginTransaction();
            $step = 'insert_user';
            $userId = Database::insertAndGetId($pdo, '
                INSERT INTO users (full_name, email, password_hash, role, status, bio)
                VALUES (:full_name, :email, :password_hash, :role, :status, :bio)
            ', [
                'full_name' => $fullName,
                'email' => $email,
                'password_hash' => $passwordHash,
                'role' => 'member',
                'status' => 'active',
                'bio' => $bio ?: 'Skill-exchange enthusiast on TimeCredit Live.',
            ]);

            $step = 'post_insert_user_check';
            $pdoErr = $pdo->errorInfo();
            if (!empty($pdoErr[2])) {
                throw new RuntimeException("PDO connection error after insert_user: " . $pdoErr[2]);
            }

            $step = 'check_wallet';
            $accCheck = $pdo->prepare('SELECT id, balance FROM credit_accounts WHERE user_id = :user_id');
            $accCheck->execute(['user_id' => $userId]);
            $accRow = $accCheck->fetch();

            if (!$accRow) {
                $step = 'insert_wallet';
                $accId = Database::insertAndGetId($pdo, 'INSERT INTO credit_accounts (user_id, balance) VALUES (:user_id, 2.00)', ['user_id' => $userId]);

                $step = 'insert_txn';
                $txnKey = 'SIGNUP_BONUS_' . $userId . '_' . time();
                $txnId = Database::insertAndGetId($pdo, "
                    INSERT INTO credit_transactions (idempotency_key, transaction_type, status)
                    VALUES (:key, 'SIGNUP_BONUS', 'COMMITTED')
                ", ['key' => $txnKey]);

                $step = 'insert_ledger';
                $pdo->prepare("
                    INSERT INTO credit_ledger_entries (transaction_id, account_id, entry_type, amount)
                    VALUES (:tid, :aid, 'CREDIT', 2.00)
                ")->execute(['tid' => $txnId, 'aid' => $accId]);
            }

            $step = 'commit';
            $pdo->commit();

            // Welcome notification (dispatched safely after commit)
            try {
                $pdo->prepare('
                    INSERT INTO notifications (user_id, title, message)
                    VALUES (:uid, :title, :msg)
                ')->execute([
                    'uid' => $userId,
                    'title' => 'Welcome to TimeCredit Live! ⏱️',
                    'msg' => 'Welcome! You have received 2.00 welcome bonus TimeCredits to start learning immediately.'
                ]);
            } catch (\Throwable $notifErr) {
                // Non-fatal: registration and wallet balance are already safely committed
            }

            // Regenerate session
            session_regenerate_id(true);
            $_SESSION['user'] = [
                'id' => $userId,
                'full_name' => $fullName,
                'email' => $email,
                'role' => 'member',
                'balance' => 2.00,
                'bio' => $bio
            ];

            $token = AuthMiddleware::generateToken($_SESSION['user']);

            AuthMiddleware::jsonResponse([
                'message' => 'Registration successful! 2.00 Welcome TimeCredits deposited.',
                'user' => $_SESSION['user'],
                'token' => $token
            ], 201);
        } catch (\Throwable $e) {
            $origError = "[Step: {$step}] " . $e->getMessage() . " (" . basename($e->getFile()) . ":" . $e->getLine() . ")";
            try {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
            } catch (\Throwable $rbErr) {
                // Ignore rollback failure to preserve original error
            }
            AuthMiddleware::jsonResponse(['error' => 'Registration failed: ' . $origError], 500);
        }
    }

    /**
     * POST /api/v1/auth/login
     */
    public static function login(): void {
        AuthMiddleware::startSession();
        $input = AuthMiddleware::getJsonInput();

        $email = strtolower(trim($input['email'] ?? ''));
        $password = $input['password'] ?? '';

        if (empty($email) || empty($password)) {
            AuthMiddleware::jsonResponse(['error' => 'Email and password are required.'], 422);
            return;
        }

        $pdo = Database::getCoreConnection();
        $stmt = $pdo->prepare('
            SELECT u.id, u.full_name, u.email, u.password_hash, u.role, u.status, u.bio,
                   COALESCE(ca.balance, 0.00) AS balance
            FROM users u
            LEFT JOIN credit_accounts ca ON u.id = ca.user_id
            WHERE u.email = :email
            LIMIT 1
        ');
        $stmt->execute(['email' => $email]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            AuthMiddleware::jsonResponse(['error' => 'Invalid email or password.'], 401);
            return;
        }

        if ($user['status'] !== 'active') {
            AuthMiddleware::jsonResponse(['error' => 'Account is suspended or inactive.'], 403);
            return;
        }

        // Regenerate session ID for security
        session_regenerate_id(true);
        $_SESSION['user'] = [
            'id' => (int)$user['id'],
            'full_name' => $user['full_name'],
            'email' => $user['email'],
            'role' => $user['role'],
            'balance' => (float)$user['balance'],
            'bio' => $user['bio']
        ];

        $token = AuthMiddleware::generateToken($_SESSION['user']);

        AuthMiddleware::jsonResponse([
            'message' => 'Login successful',
            'user' => $_SESSION['user'],
            'token' => $token
        ]);
    }

    /**
     * POST /api/v1/auth/logout
     */
    public static function logout(): void {
        AuthMiddleware::startSession();
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(
                session_name(),
                '',
                time() - 42000,
                $params['path'],
                $params['domain'],
                $params['secure'],
                $params['httponly']
            );
        }
        session_destroy();
        AuthMiddleware::jsonResponse(['message' => 'Logged out successfully.']);
    }

    /**
     * GET /api/v1/me
     */
    public static function me(): void {
        $currentUser = AuthMiddleware::requireAuth();
        $pdo = Database::getCoreConnection();

        $stmt = $pdo->prepare("
            SELECT u.id, u.full_name, u.email, u.role, u.status, u.bio, u.created_at,
                   COALESCE(ca.balance, 0.00) AS balance,
                   (SELECT COUNT(*) FROM user_skills WHERE user_id = u.id AND skill_type = 'OFFER') AS skills_offered_count,
                   (SELECT COUNT(*) FROM user_skills WHERE user_id = u.id AND skill_type = 'WANT') AS skills_wanted_count,
                   (SELECT COUNT(*) FROM service_requests WHERE teacher_id = u.id AND status = 'Pending') AS pending_requests_count,
                   (SELECT COUNT(*) FROM sessions WHERE (teacher_id = u.id OR learner_id = u.id) AND status = 'SCHEDULED') AS upcoming_sessions_count
            FROM users u
            LEFT JOIN credit_accounts ca ON u.id = ca.user_id
            WHERE u.id = :id
            LIMIT 1
        ");
        $stmt->execute(['id' => $currentUser['id']]);
        $data = $stmt->fetch();

        if (!$data) {
            AuthMiddleware::jsonResponse(['error' => 'User not found.'], 404);
            return;
        }

        $data['balance'] = (float)$data['balance'];
        $token = AuthMiddleware::generateToken($data);

        AuthMiddleware::jsonResponse([
            'user' => $data,
            'token' => $token
        ]);
    }

    /**
     * PUT /api/v1/auth/profile
     */
    public static function updateProfile(): void {
        $currentUser = AuthMiddleware::requireAuth();
        $input = AuthMiddleware::getJsonInput();

        $fullName = trim($input['full_name'] ?? '');
        $bio = trim($input['bio'] ?? '');

        if (empty($fullName)) {
            AuthMiddleware::jsonResponse(['error' => 'Full name cannot be blank.'], 422);
            return;
        }

        $pdo = Database::getCoreConnection();
        $stmt = $pdo->prepare('UPDATE users SET full_name = :name, bio = :bio WHERE id = :id');
        $stmt->execute([
            'name' => $fullName,
            'bio' => $bio,
            'id' => $currentUser['id']
        ]);

        $_SESSION['user']['full_name'] = $fullName;
        $_SESSION['user']['bio'] = $bio;

        AuthMiddleware::jsonResponse([
            'message' => 'Profile updated successfully!',
            'user' => $_SESSION['user']
        ]);
    }

    /**
     * POST /api/v1/auth/change-password
     */
    public static function changePassword(): void {
        $currentUser = AuthMiddleware::requireAuth();
        $input = AuthMiddleware::getJsonInput();

        $currentPassword = $input['current_password'] ?? '';
        $newPassword = $input['new_password'] ?? '';
        $confirmPassword = $input['confirm_password'] ?? '';

        if (empty($currentPassword) || empty($newPassword)) {
            AuthMiddleware::jsonResponse(['error' => 'Current and new password are required.'], 422);
            return;
        }

        if (strlen($newPassword) < 8) {
            AuthMiddleware::jsonResponse(['error' => 'New password must be at least 8 characters long.'], 422);
            return;
        }

        if ($newPassword !== $confirmPassword) {
            AuthMiddleware::jsonResponse(['error' => 'New password confirmation does not match.'], 422);
            return;
        }

        $pdo = Database::getCoreConnection();
        $stmt = $pdo->prepare('SELECT password_hash FROM users WHERE id = :id');
        $stmt->execute(['id' => $currentUser['id']]);
        $hash = $stmt->fetchColumn();

        if (!$hash || !password_verify($currentPassword, $hash)) {
            AuthMiddleware::jsonResponse(['error' => 'Current password is incorrect.'], 400);
            return;
        }

        $newHash = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 10]);
        $upd = $pdo->prepare('UPDATE users SET password_hash = :hash WHERE id = :id');
        $upd->execute(['hash' => $newHash, 'id' => $currentUser['id']]);

        AuthMiddleware::jsonResponse(['message' => 'Password updated successfully!']);
    }
}
