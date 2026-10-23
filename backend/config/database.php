<?php
declare(strict_types=1);

/**
 * TimeCredit Live - Database Configuration
 * Supports both MySQL and PostgreSQL (e.g. Neon Serverless Postgres, Supabase, AWS RDS).
 * Supports direct connection URL (DATABASE_URL) or discrete environment variables.
 */

if (!function_exists('parseTimeCreditDbConfig')) {
    function parseTimeCreditDbConfig(string $prefix = 'DB_', string $defaultDb = 'timecredit_db'): array {
        // 1. Direct DATABASE_URL or POSTGRES_URL (e.g. Render, Neon, Supabase, Railway)
        $dbUrl = getenv($prefix . 'URL') ?: getenv('DATABASE_URL') ?: getenv('POSTGRES_URL');
        if (!empty($dbUrl)) {
            $parsed = parse_url($dbUrl);
            if ($parsed !== false && isset($parsed['host'])) {
                $scheme = $parsed['scheme'] ?? 'pgsql';
                $driver = ($scheme === 'postgres' || $scheme === 'postgresql' || $scheme === 'pgsql') ? 'pgsql' : 'mysql';
                $dbName = isset($parsed['path']) ? ltrim($parsed['path'], '/') : $defaultDb;
                $user = isset($parsed['user']) ? urldecode($parsed['user']) : 'root';
                $pass = isset($parsed['pass']) ? urldecode($parsed['pass']) : '';
                $host = $parsed['host'] ?? '127.0.0.1';
                $port = isset($parsed['port']) ? (int)$parsed['port'] : ($driver === 'pgsql' ? 5432 : 3306);

                $query = [];
                if (isset($parsed['query'])) {
                    parse_str($parsed['query'], $query);
                }
                $sslmode = $query['sslmode'] ?? ($driver === 'pgsql' ? 'require' : null);

                return [
                    'driver' => $driver,
                    'host' => $host,
                    'port' => $port,
                    'database' => $dbName,
                    'username' => $user,
                    'password' => $pass,
                    'sslmode' => $sslmode,
                    'charset' => ($driver === 'pgsql') ? 'utf8' : 'utf8mb4',
                ];
            }
        }

        // 2. Discrete environment variables
        $connection = getenv($prefix . 'CONNECTION') ?: getenv('DB_CONNECTION');
        $host = getenv($prefix . 'HOST') ?: getenv('DB_HOST') ?: '127.0.0.1';
        $port = (int)(getenv($prefix . 'PORT') ?: getenv('DB_PORT') ?: 0);
        $database = getenv($prefix . 'DATABASE') ?: getenv('DB_DATABASE') ?: $defaultDb;
        $username = getenv($prefix . 'USERNAME') ?: getenv('DB_USERNAME') ?: 'root';
        $password = getenv($prefix . 'PASSWORD') !== false ? getenv($prefix . 'PASSWORD') : (getenv('DB_PASSWORD') !== false ? getenv('DB_PASSWORD') : '');
        $sslmode = getenv($prefix . 'SSLMODE') ?: getenv('DB_SSLMODE') ?: 'require';

        // Auto-detect driver
        if (empty($connection)) {
            if ($port === 5432 || str_contains($host, 'neon.tech') || str_contains($host, 'postgres') || str_contains($host, 'supabase')) {
                $driver = 'pgsql';
            } else {
                $driver = 'mysql';
            }
        } else {
            $driver = ($connection === 'postgres' || $connection === 'postgresql' || $connection === 'pgsql') ? 'pgsql' : 'mysql';
        }

        if ($port === 0) {
            $port = ($driver === 'pgsql') ? 5432 : 3306;
        }

        return [
            'driver' => $driver,
            'host' => $host,
            'port' => $port,
            'database' => $database,
            'username' => $username,
            'password' => $password,
            'sslmode' => $sslmode,
            'charset' => ($driver === 'pgsql') ? 'utf8' : 'utf8mb4',
        ];
    }
}

$coreConfig = parseTimeCreditDbConfig('DB_', 'timecredit_db');
$practiceConfig = parseTimeCreditDbConfig('PRACTICE_DB_', 'timecredit_practice');

$commonOptions = [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
    PDO::ATTR_PERSISTENT => false,
];

return [
    'core' => array_merge($coreConfig, ['options' => $commonOptions]),
    'practice' => array_merge($practiceConfig, ['options' => array_merge($commonOptions, [PDO::ATTR_TIMEOUT => 5])]),
    'session' => [
        'lifetime' => 86400 * 7,
        'cookie_httponly' => true,
        'cookie_secure' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on',
        'cookie_samesite' => 'Lax',
    ],
];
