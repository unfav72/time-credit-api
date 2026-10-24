<?php
declare(strict_types=1);

namespace TimeCredit\Repositories;

use PDO;
use PDOException;
use RuntimeException;

class Database {
    private static ?PDO $coreConnection = null;
    private static ?PDO $practiceConnection = null;

    /**
     * Create a configured PDO connection supporting PostgreSQL (Neon) and MySQL.
     */
    private static function createConnection(array $config, string $type): PDO {
        $driver = $config['driver'] ?? 'mysql';

        if ($driver === 'pgsql') {
            $sslmodePart = !empty($config['sslmode']) ? ";sslmode={$config['sslmode']}" : ';sslmode=require';
            $dsn = sprintf(
                'pgsql:host=%s;port=%d;dbname=%s%s',
                $config['host'],
                $config['port'],
                $config['database'],
                $sslmodePart
            );
        } elseif ($driver === 'sqlite') {
            $dsn = sprintf('sqlite:%s', $config['database']);
        } else {
            $dsn = sprintf(
                'mysql:host=%s;port=%d;dbname=%s;charset=%s',
                $config['host'],
                $config['port'],
                $config['database'],
                $config['charset'] ?? 'utf8mb4'
            );
        }

        try {
            $pdo = new PDO(
                $dsn,
                $driver === 'sqlite' ? null : $config['username'],
                $driver === 'sqlite' ? null : $config['password'],
                $config['options'] ?? []
            );

            // Set explicit UTC timezone for PostgreSQL & MySQL
            if ($driver === 'pgsql') {
                $pdo->exec("SET TIME ZONE 'UTC'");
            } elseif ($driver === 'mysql') {
                $pdo->exec("SET time_zone = '+00:00'");
            } elseif ($driver === 'sqlite') {
                $pdo->exec("PRAGMA foreign_keys = ON");
            }

            return $pdo;
        } catch (PDOException $e) {
            throw new RuntimeException("{$type} Database ({$driver}) Connection Failed: " . $e->getMessage(), (int)$e->getCode());
        }
    }

    /**
     * Get or create core application database connection.
     */
    public static function getCoreConnection(): PDO {
        if (self::$coreConnection === null) {
            $config = (require __DIR__ . '/../../config/database.php')['core'];
            self::$coreConnection = self::createConnection($config, 'Core');
        }
        return self::$coreConnection;
    }

    /**
     * Get or create controlled practice database connection (for SQL Query Lab).
     */
    public static function getPracticeConnection(): PDO {
        if (self::$practiceConnection === null) {
            $config = (require __DIR__ . '/../../config/database.php')['practice'];
            self::$practiceConnection = self::createConnection($config, 'Practice');
        }
        return self::$practiceConnection;
    }

    /**
     * Driver-agnostic helper to retrieve the last inserted auto-increment / serial ID.
     * Works seamlessly across both PostgreSQL sequences and MySQL AUTO_INCREMENT.
     */
    public static function getLastInsertId(PDO $pdo, ?string $table = null, string $column = 'id'): int {
        try {
            if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'pgsql' && $table !== null) {
                $seqName = "{$table}_{$column}_seq";
                $val = $pdo->lastInsertId($seqName);
                if ($val !== false && is_numeric($val) && (int)$val > 0) {
                    return (int)$val;
                }
            }
        } catch (\Throwable $e) {
            // Fall through to standard lastInsertId
        }

        $val = $pdo->lastInsertId();
        return ($val !== false && is_numeric($val)) ? (int)$val : 0;
    }
}
