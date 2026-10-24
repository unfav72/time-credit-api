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
    } elseif ($requestUri === '/api/v1/me' && $method === 'GET') {
        AuthController::me();
    } elseif ($requestUri === '/api/v1/auth/profile' && $method === 'PUT') {
        AuthController::updateProfile();
    } elseif ($requestUri === '/api/v1/auth/change-password' && $method === 'POST') {
        AuthController::changePassword();
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
