<?php
declare(strict_types=1);

/**
 * TimeCredit Live - Main API Router & Front Controller
 * PHP 8.3+ REST API Backend
 */

// Enable error reporting in development
error_reporting(E_ALL);
ini_set('display_errors', '0');

// CORS Headers
$origin = $_SERVER['HTTP_ORIGIN'] ?? 'http://localhost:5173';
header("Access-Control-Allow-Origin: {$origin}");
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Autoloader for TimeCredit namespace
spl_autoload_register(function ($class) {
    $prefix = 'TimeCredit\\';
    $baseDir = __DIR__ . '/../src/';

    $len = strlen($prefix);
    if (strncmp($prefix, $class, $len) !== 0) {
        return;
    }

    $relativeClass = substr($class, $len);
    $file = $baseDir . str_replace('\\', '/', $relativeClass) . '.php';

    if (file_exists($file)) {
        require_once $file;
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
use TimeCredit\Middleware\AuthMiddleware;

// Extract URI path
$requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];

// Health check
if ($requestUri === '/' || $requestUri === '/api/health') {
    AuthMiddleware::jsonResponse([
        'status' => 'healthy',
        'application' => 'TimeCredit Live API',
        'version' => '1.0.0',
        'timestamp' => date('c')
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
