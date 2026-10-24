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
     * Driver-agnostic helper to execute an INSERT and retrieve the inserted primary key ID.
     * For PostgreSQL, appends "RETURNING <column>" and fetches the ID directly from the result set.
     * For MySQL / SQLite, executes the query and retrieves $pdo->lastInsertId().
     * This avoids calling currval() which aborts transactions in PostgreSQL.
     */
    public static function insertAndGetId(PDO $pdo, string $sql, array $params = [], string $column = 'id'): int {
        $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
        if ($driver === 'pgsql') {
            $trimmed = rtrim($sql, "; \t\n\r");
            if (!stripos($trimmed, 'RETURNING')) {
                $trimmed .= " RETURNING {$column}";
            }
            $stmt = $pdo->prepare($trimmed);
            $stmt->execute($params);
            $id = $stmt->fetchColumn();
            return ($id !== false && is_numeric($id)) ? (int)$id : 0;
        }

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $id = $pdo->lastInsertId();
        return ($id !== false && is_numeric($id)) ? (int)$id : 0;
    }

    /**
     * Driver-agnostic helper to retrieve the last inserted auto-increment / serial ID.
     * Works seamlessly across both PostgreSQL sequences and MySQL AUTO_INCREMENT.
     */
    public static function getLastInsertId(PDO $pdo, ?string $table = null, string $column = 'id'): int {
        $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
        if ($driver === 'pgsql') {
            try {
                if ($table !== null) {
                    $stmt = $pdo->prepare("SELECT pg_get_serial_sequence(:tbl, :col)");
                    $stmt->execute(['tbl' => $table, 'col' => $column]);
                    $seq = $stmt->fetchColumn();
                    if ($seq) {
                        $val = $pdo->query("SELECT currval('$seq')")->fetchColumn();
                        if ($val !== false && is_numeric($val) && (int)$val > 0) {
                            return (int)$val;
                        }
                    }
                }
            } catch (\Throwable $e) {
                // Ignore sequence check failure
            }
            try {
                $val = $pdo->query("SELECT lastval()")->fetchColumn();
                if ($val !== false && is_numeric($val) && (int)$val > 0) {
                    return (int)$val;
                }
            } catch (\Throwable $e) {
                // Ignore lastval failure
            }
            return 0;
        }

        $val = $pdo->lastInsertId();
        return ($val !== false && is_numeric($val)) ? (int)$val : 0;
    }
}
