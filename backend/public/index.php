<?php
declare(strict_types=1);

/**
 * TimeCredit Live - Main API Router & Front Controller
 * PHP 8.3+ REST API Backend
 */

error_reporting(E_ALL);
ini_set('display_errors', '0');

// Strict CORS Origins Whitelist
$allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://localhost:8000',
    'https://frontend-five-jade-83.vercel.app',
];
$customFrontend = getenv('FRONTEND_URL');
if (!empty($customFrontend)) {
    $allowedOrigins[] = rtrim($customFrontend, '/');
}

$httpOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($httpOrigin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: {$httpOrigin}");
    header('Access-Control-Allow-Credentials: true');
} else {
    // Default safe fallback if origin is in development or matching vercel app preview
    if (!empty($httpOrigin) && (str_ends_with($httpOrigin, '.vercel.app') || str_contains($httpOrigin, 'localhost'))) {
        header("Access-Control-Allow-Origin: {$httpOrigin}");
        header('Access-Control-Allow-Credentials: true');
    }
}

header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Razorpay-Signature');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Robust autoloader for TimeCredit namespace (supports Linux case-sensitive filesystems)
spl_autoload_register(function ($class) {
    $prefix = 'TimeCredit\\';
    $baseDir = __DIR__ . '/../src/';

    $len = strlen($prefix);
    if (strncmp($prefix, $class, $len) !== 0) {
        return;
    }

    $relativeClass = substr($class, $len);
    $parts = explode('\\', $relativeClass);
    $className = array_pop($parts);
    $dirLower = strtolower(implode('/', $parts));
    $dirExact = implode('/', $parts);

    $candidates = [
        $baseDir . str_replace('\\', '/', $relativeClass) . '.php',
        $baseDir . ($dirLower ? $dirLower . '/' : '') . $className . '.php',
        $baseDir . ($dirExact ? $dirExact . '/' : '') . $className . '.php',
    ];

    foreach ($candidates as $file) {
        if (file_exists($file)) {
            require_once $file;
            return;
        }
    }
});

use TimeCredit\Controllers\AuthController;
use TimeCredit\Controllers\ChatController;
use TimeCredit\Controllers\SkillController;
use TimeCredit\Controllers\RequestController;
use TimeCredit\Controllers\SessionController;
use TimeCredit\Controllers\WalletController;
use TimeCredit\Controllers\SqlLabController;
use TimeCredit\Controllers\ReportController;
use TimeCredit\Controllers\PaymentController;
use TimeCredit\Controllers\NotificationController;
use TimeCredit\Controllers\WhiteboardController;
use TimeCredit\Middleware\AuthMiddleware;
use TimeCredit\Repositories\Database;

// Extract and normalize URI path
$rawPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/';
// Collapse duplicate /api prefixes (e.g. /api/api/v1/... -> /api/v1/...)
$cleanPath = preg_replace('#^(/api)+#', '/api', $rawPath);
// Normalize non-versioned /api/ routes to /api/v1/ (except /api/health)
if ($cleanPath !== '/api/health' && str_starts_with($cleanPath, '/api/') && !str_starts_with($cleanPath, '/api/v1/')) {
    $cleanPath = preg_replace('#^/api/#', '/api/v1/', $cleanPath);
}
$requestUri = $cleanPath;
$method = $_SERVER['REQUEST_METHOD'];

// Health check endpoint with database connectivity check
if ($requestUri === '/' || $requestUri === '/api/health') {
    $dbStatus = 'unknown';
    $dbDriver = 'none';
    try {
        $pdo = Database::getCoreConnection();
        $dbDriver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
        $pdo->query('SELECT 1');
        $dbStatus = 'connected';
    } catch (\Throwable $e) {
        $dbStatus = 'disconnected (' . $e->getMessage() . ')';
    }

    AuthMiddleware::jsonResponse([
        'status' => 'healthy',
        'application' => 'TimeCredit Live API',
        'version' => '1.0.0',
        'database' => [
            'status' => $dbStatus,
            'driver' => $dbDriver,
        ],
        'timestamp' => gmdate('Y-m-d\TH:i:s\Z')
    ]);
    exit;
}

try {
    // --- AUTH ROUTES ---
    if ($requestUri === '/api/v1/auth/register' && $method === 'POST') {
        AuthController::register();
    } elseif ($requestUri === '/api/v1/auth/login' && $method === 'POST') {
        AuthController::login();
    } elseif ($requestUri === '/api/v1/auth/logout' && $method === 'POST') {
        AuthController::logout();
    } elseif (($requestUri === '/api/v1/me' || $requestUri === '/api/v1/auth/me') && $method === 'GET') {
        AuthController::me();
    } elseif ($requestUri === '/api/v1/auth/profile' && $method === 'PUT') {
        AuthController::updateProfile();
    } elseif ($requestUri === '/api/v1/auth/change-password' && $method === 'POST') {
        AuthController::changePassword();
    }

    // --- SYSTEM & DATABASE SETUP ROUTE ---
    elseif (($requestUri === '/api/v1/system/setup' || $requestUri === '/api/system/setup') && in_array($method, ['GET', 'POST'])) {
        $pdo = Database::getCoreConnection();
        $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);

        // Run migrations
        $applied = [];
        $errors = [];
        if ($driver === 'pgsql') {
            $pdo->exec("CREATE TABLE IF NOT EXISTS schema_migrations (
                id SERIAL PRIMARY KEY,
                migration VARCHAR(255) NOT NULL UNIQUE,
                applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )");
        } else {
            $pdo->exec("CREATE TABLE IF NOT EXISTS schema_migrations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                migration VARCHAR(255) NOT NULL UNIQUE,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB");
        }

        $appliedList = $pdo->query("SELECT migration FROM schema_migrations")->fetchAll(PDO::FETCH_COLUMN);

        $migrationsDir = __DIR__ . '/../database/migrations';
        $files = glob($migrationsDir . '/*.sql');
        sort($files);

        foreach ($files as $file) {
            $fn = basename($file);
            if (in_array($fn, $appliedList, true)) continue;
            try {
                if ($driver !== 'pgsql' && str_contains($fn, 'sequences')) {
                    $applied[] = "{$fn} (skipped non-pgsql)";
                    continue;
                }
                $sql = file_get_contents($file);
                $pdo->exec($sql);
                $pdo->prepare("INSERT INTO schema_migrations (migration) VALUES (:m)")->execute(['m' => $fn]);
                $applied[] = $fn;
            } catch (\Throwable $mErr) {
                $errors[] = "Migration {$fn} failed: " . $mErr->getMessage();
            }
        }

        // Synchronize PostgreSQL sequences
        $seqReport = [];
        if ($driver === 'pgsql') {
            $tables = ['users', 'skill_categories', 'skills', 'user_skills', 'service_offers', 'service_requests', 'sessions', 'credit_accounts', 'credit_transactions', 'credit_ledger_entries', 'reviews', 'notifications', 'saved_queries', 'audit_logs'];
            foreach ($tables as $tbl) {
                try {
                    $seqStmt = $pdo->prepare("SELECT pg_get_serial_sequence(:t, 'id')");
                    $seqStmt->execute(['t' => $tbl]);
                    $seq = $seqStmt->fetchColumn();
                    if ($seq) {
                        $maxId = (int)$pdo->query("SELECT COALESCE(MAX(id), 0) FROM {$tbl}")->fetchColumn();
                        $val = max($maxId, 1);
                        $pdo->query("SELECT setval('{$seq}', {$val})");
                        $seqReport[$tbl] = ['sequence' => $seq, 'max_id' => $maxId, 'new_currval' => $val];
                    }
                } catch (\Throwable $sErr) {
                    $seqReport[$tbl] = ['error' => $sErr->getMessage()];
                }
            }
        }

        // Table counts
        $counts = [];
        $checkTables = ['users', 'credit_accounts', 'credit_transactions', 'credit_ledger_entries', 'skills', 'service_offers'];
        foreach ($checkTables as $ct) {
            try {
                $counts[$ct] = (int)$pdo->query("SELECT COUNT(*) FROM {$ct}")->fetchColumn();
            } catch (\Throwable $cErr) {
                $counts[$ct] = 'error: ' . $cErr->getMessage();
            }
        }

        // Trigger inspection
        $triggers = [];
        if ($driver === 'pgsql') {
            try {
                $trigStmt = $pdo->query("
                    SELECT tg.tgname, pr.proname, pr.prosrc
                    FROM pg_trigger tg
                    JOIN pg_proc pr ON tg.tgfoid = pr.oid
                    WHERE tg.tgrelid = 'users'::regclass
                ");
                $triggers = $trigStmt->fetchAll();
            } catch (\Throwable $tErr) {
                $triggers = ['error' => $tErr->getMessage()];
            }
        }

        // Test user insert
        $insertTest = [];
        try {
            $pdo->beginTransaction();
            $testEmail = 'debug_' . time() . '@test.com';
            $tStmt = $pdo->prepare("
                INSERT INTO users (full_name, email, password_hash, role, status, bio)
                VALUES ('Debug Test', :email, 'dummyhash', 'member', 'active', 'Debug bio')
                RETURNING id
            ");
            $tStmt->execute(['email' => $testEmail]);
            $insertedId = $tStmt->fetchColumn();

            // Check if transaction is still healthy
            $tAcc = $pdo->prepare("SELECT id, balance FROM credit_accounts WHERE user_id = :uid");
            $tAcc->execute(['uid' => $insertedId]);
            $accData = $tAcc->fetch();

            $pdo->rollBack();
            $insertTest = [
                'result' => 'SUCCESS',
                'inserted_user_id' => $insertedId,
                'wallet_created_by_trigger' => $accData ? true : false,
                'wallet_data' => $accData
            ];
        } catch (\Throwable $itErr) {
            try { if ($pdo->inTransaction()) $pdo->rollBack(); } catch (\Throwable $rb) {}
            $insertTest = [
                'result' => 'FAILED',
                'error' => $itErr->getMessage(),
                'code' => $itErr->getCode(),
                'file' => basename($itErr->getFile()) . ':' . $itErr->getLine()
            ];
        }

        AuthMiddleware::jsonResponse([
            'status' => empty($errors) ? 'success' : 'partial',
            'driver' => $driver,
            'migrations_applied' => $applied,
            'migration_errors' => $errors,
            'sequences' => $seqReport,
            'table_counts' => $counts,
            'triggers_on_users' => $triggers,
            'insert_test' => $insertTest
        ]);
        exit;
    }

    // --- SYSTEM CLEANUP ROUTE ---
    elseif (($requestUri === '/api/v1/system/cleanup' || $requestUri === '/api/system/cleanup') && in_array($method, ['GET', 'POST'])) {
        $pdo = Database::getCoreConnection();
        $report = [];
        try {
            $stmt = $pdo->query("SELECT id FROM users WHERE full_name ILIKE '%Host Tester%' OR email ILIKE '%host_test_%'");
            $uids = $stmt->fetchAll(PDO::FETCH_COLUMN);
            if (!empty($uids)) {
                $in = implode(',', array_map('intval', $uids));
                $count = $pdo->exec("DELETE FROM users WHERE id IN ({$in})");
                $report['host_testers_deleted'] = $count;
            }

            $pdo->exec("
                DELETE FROM sessions WHERE request_id IN (
                    SELECT sr.id FROM service_requests sr
                    JOIN service_offers so ON sr.offer_id = so.id
                    WHERE so.title ILIKE 'gaming'
                )
            ");
            $pdo->exec("
                DELETE FROM service_requests WHERE offer_id IN (
                    SELECT id FROM service_offers WHERE title ILIKE 'gaming'
                )
            ");
            $offCount = $pdo->exec("DELETE FROM service_offers WHERE title ILIKE 'gaming'");
            $report['test_offers_deleted'] = $offCount;

            $report['status'] = 'success';
        } catch (\Throwable $e) {
            $report['error'] = $e->getMessage();
        }
        AuthMiddleware::jsonResponse($report);
        exit;
    }

    // --- SKILLS & OFFERS ROUTES ---
    elseif ($requestUri === '/api/v1/skills' && $method === 'GET') {
        SkillController::index();
    } elseif ($requestUri === '/api/v1/skills' && $method === 'POST') {
        SkillController::createSkill();
    } elseif ($requestUri === '/api/v1/categories' && $method === 'GET') {
        SkillController::categories();
    } elseif ($requestUri === '/api/v1/offers' && $method === 'GET') {
        SkillController::browseOffers();
    } elseif ($requestUri === '/api/v1/offers' && $method === 'POST') {
        SkillController::createOffer();
    } elseif ($requestUri === '/api/v1/skills/matches' && $method === 'GET') {
        SkillController::matches();
    } elseif ($requestUri === '/api/v1/user/skills' && $method === 'GET') {
        SkillController::getUserSkills();
    } elseif ($requestUri === '/api/v1/user/skills' && $method === 'POST') {
        SkillController::addUserSkill();
    } elseif (preg_match('#^/api/v1/user/skills/(\d+)$#', $requestUri, $matches) && $method === 'DELETE') {
        SkillController::removeUserSkill((int)$matches[1]);
    } elseif (preg_match('#^/api/v1/users/(\d+)/profile$#', $requestUri, $matches) && $method === 'GET') {
        SkillController::getPublicProfile((int)$matches[1]);
    }

    // --- SERVICE REQUESTS ROUTES ---
    elseif ($requestUri === '/api/v1/requests' && $method === 'GET') {
        RequestController::index();
    } elseif ($requestUri === '/api/v1/requests' && $method === 'POST') {
        RequestController::create();
    } elseif (preg_match('#^/api/v1/requests/(\d+)/accept$#', $requestUri, $matches) && $method === 'POST') {
        RequestController::accept((int)$matches[1]);
    } elseif (preg_match('#^/api/v1/requests/(\d+)/reject$#', $requestUri, $matches) && $method === 'POST') {
        RequestController::reject((int)$matches[1]);
    }

    // --- SESSIONS & CLASSROOM ROUTES ---
    elseif ($requestUri === '/api/v1/sessions' && $method === 'GET') {
        SessionController::index();
    } elseif ($requestUri === '/api/v1/sessions/live' && $method === 'GET') {
        SessionController::live();
    } elseif ($requestUri === '/api/v1/sessions/create' && $method === 'POST') {
        SessionController::create();
    } elseif (preg_match('#^/api/v1/sessions/(\d+)/join$#', $requestUri, $matches) && $method === 'POST') {
        SessionController::join((int)$matches[1]);
    } elseif (preg_match('#^/api/v1/sessions/(\d+)/complete$#', $requestUri, $matches) && $method === 'POST') {
        SessionController::complete((int)$matches[1]);
    } elseif (preg_match('#^/api/v1/sessions/(\d+)/review$#', $requestUri, $matches) && $method === 'POST') {
        SessionController::review((int)$matches[1]);
    }

    // --- COLLABORATIVE WHITEBOARD & IN-MEETING CHAT ---
    elseif (preg_match('#^/api/v1/sessions/(\d+)/meeting-config$#', $requestUri, $matches) && $method === 'GET') {
        WhiteboardController::getMeetingConfig((int)$matches[1]);
    } elseif (preg_match('#^/api/v1/sessions/(\d+)/whiteboard$#', $requestUri, $matches) && $method === 'GET') {
        WhiteboardController::getWhiteboard((int)$matches[1]);
    } elseif (preg_match('#^/api/v1/sessions/(\d+)/whiteboard/stroke$#', $requestUri, $matches) && $method === 'POST') {
        WhiteboardController::addStroke((int)$matches[1]);
    } elseif (preg_match('#^/api/v1/sessions/(\d+)/whiteboard/clear$#', $requestUri, $matches) && $method === 'POST') {
        WhiteboardController::clearWhiteboard((int)$matches[1]);
    } elseif (preg_match('#^/api/v1/sessions/(\d+)/chat$#', $requestUri, $matches) && $method === 'GET') {
        WhiteboardController::getChat((int)$matches[1]);
    } elseif (preg_match('#^/api/v1/sessions/(\d+)/chat$#', $requestUri, $matches) && $method === 'POST') {
        WhiteboardController::sendChatMessage((int)$matches[1]);
    }

    // --- WEBRTC P2P LIVE STREAM SIGNALING ---
    elseif (preg_match('#^/api/v1/sessions/(\d+)/signal$#', $requestUri, $matches) && $method === 'POST') {
        ChatController::sendSignal((int)$matches[1]);
    } elseif (preg_match('#^/api/v1/sessions/(\d+)/signal$#', $requestUri, $matches) && $method === 'GET') {
        ChatController::getSignals((int)$matches[1]);
    }

    // --- FRIENDSHIPS & DIRECT MESSAGING ---
    elseif ($requestUri === '/api/v1/friends' && $method === 'GET') {
        ChatController::getFriends();
    } elseif ($requestUri === '/api/v1/friends/request' && $method === 'POST') {
        ChatController::sendFriendRequest();
    } elseif (preg_match('#^/api/v1/friends/(\d+)/accept$#', $requestUri, $matches) && $method === 'POST') {
        ChatController::acceptFriendRequest((int)$matches[1]);
    } elseif (preg_match('#^/api/v1/friends/(\d+)/decline$#', $requestUri, $matches) && $method === 'POST') {
        ChatController::declineFriendRequest((int)$matches[1]);
    } elseif ($requestUri === '/api/v1/users/directory' && $method === 'GET') {
        ChatController::searchUsers();
    } elseif ($requestUri === '/api/v1/messages/conversations' && $method === 'GET') {
        ChatController::getConversations();
    } elseif (preg_match('#^/api/v1/messages/(\d+)$#', $requestUri, $matches) && $method === 'GET') {
        ChatController::getDirectMessages((int)$matches[1]);
    } elseif (preg_match('#^/api/v1/messages/(\d+)$#', $requestUri, $matches) && $method === 'POST') {
        ChatController::sendDirectMessage((int)$matches[1]);
    }

    // --- WALLET ROUTES ---
    elseif ($requestUri === '/api/v1/wallet' && $method === 'GET') {
        WalletController::getWallet();
    }

    // --- TIMECREDIT TOP-UP & RAZORPAY PAYMENT ROUTES ---
    elseif ($requestUri === '/api/v1/topup/packages' && $method === 'GET') {
        PaymentController::getPackages();
    } elseif ($requestUri === '/api/v1/payments/create-order' && $method === 'POST') {
        PaymentController::createOrder();
    } elseif ($requestUri === '/api/v1/payments/verify' && $method === 'POST') {
        PaymentController::verifyPayment();
    } elseif ($requestUri === '/api/v1/payments/history' && $method === 'GET') {
        PaymentController::getHistory();
    } elseif ($requestUri === '/api/v1/payments/webhook' && $method === 'POST') {
        PaymentController::webhook();
    }

    // --- NOTIFICATIONS & WEB PUSH ROUTES ---
    elseif ($requestUri === '/api/v1/notifications' && $method === 'GET') {
        NotificationController::index();
    } elseif (preg_match('#^/api/v1/notifications/(\d+)/read$#', $requestUri, $matches) && $method === 'POST') {
        NotificationController::markAsRead((int)$matches[1]);
    } elseif ($requestUri === '/api/v1/notifications/read-all' && $method === 'POST') {
        NotificationController::markAllAsRead();
    } elseif ($requestUri === '/api/v1/push/subscribe' && $method === 'POST') {
        NotificationController::subscribePush();
    } elseif ($requestUri === '/api/v1/push/subscribe' && $method === 'DELETE') {
        NotificationController::unsubscribePush();
    } elseif ($requestUri === '/api/v1/push/public-key' && $method === 'GET') {
        NotificationController::getPublicKey();
    }

    // --- SQL QUERY LAB ROUTES ---
    elseif ($requestUri === '/api/v1/sql/execute' && $method === 'POST') {
        SqlLabController::execute();
    } elseif ($requestUri === '/api/v1/sql/schema' && $method === 'GET') {
        SqlLabController::getSchema();
    } elseif ($requestUri === '/api/v1/sql/reset' && $method === 'POST') {
        SqlLabController::resetPracticeDatabase();
    } elseif ($requestUri === '/api/v1/sql/saved-queries' && $method === 'GET') {
        SqlLabController::getSavedQueries();
    } elseif ($requestUri === '/api/v1/sql/saved-queries' && $method === 'POST') {
        SqlLabController::saveQuery();
    } elseif ($requestUri === '/api/v1/sql/history' && $method === 'GET') {
        SqlLabController::getHistory();
    }

    // --- REPORTS ROUTES ---
    elseif ($requestUri === '/api/v1/reports/popular-skills' && $method === 'GET') {
        ReportController::popularSkills();
    } elseif ($requestUri === '/api/v1/reports/teacher-leaderboard' && $method === 'GET') {
        ReportController::teacherLeaderboard();
    } elseif ($requestUri === '/api/v1/reports/platform-metrics' && $method === 'GET') {
        ReportController::platformMetrics();
    }

    else {
        AuthMiddleware::jsonResponse(['error' => 'Route not found: ' . $requestUri], 404);
    }
} catch (\Throwable $e) {
    AuthMiddleware::jsonResponse([
        'error' => 'Server Error: ' . $e->getMessage(),
        'file' => basename($e->getFile()),
        'line' => $e->getLine()
    ], 500);
}
