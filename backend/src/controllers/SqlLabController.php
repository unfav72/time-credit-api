<?php
declare(strict_types=1);

namespace TimeCredit\Controllers;

use PDO;
use TimeCredit\Middleware\AuthMiddleware;
use TimeCredit\Repositories\Database;

class SqlLabController {
    /**
     * POST /api/v1/sql/execute
     * Executes queries against the controlled practice database or safe views.
     */
    public static function execute(): void {
        $user = AuthMiddleware::requireAuth();
        $input = AuthMiddleware::getJsonInput();

        $sql = trim($input['query'] ?? '');
        $database = $input['database'] ?? 'practice'; // 'practice' or 'core'

        if (empty($sql)) {
            AuthMiddleware::jsonResponse(['error' => 'Query cannot be empty.'], 422);
            return;
        }

        // Enforce safety rules:
        // If target is core application database, restrict to read-only queries and protect passwords/secrets
        $upperSql = strtoupper($sql);
        if ($database === 'core') {
            $isDangerous = preg_match('/\b(DROP|TRUNCATE|DELETE|UPDATE|INSERT|ALTER|CREATE|GRANT|REVOKE)\b/i', $sql);
            if ($isDangerous) {
                AuthMiddleware::jsonResponse([
                    'error' => 'Permission Denied: Core Application database is in READ-ONLY mode. Use the Practice Sandbox Database for DML/DDL modifications.'
                ], 403);
                return;
            }

            if (stripos($sql, 'password_hash') !== false) {
                AuthMiddleware::jsonResponse([
                    'error' => 'Security Violation: Access to password hashes and security tokens is strictly forbidden.'
                ], 403);
                return;
            }
        }

        $startTime = microtime(true);
        $pdo = ($database === 'core') ? Database::getCoreConnection() : Database::getPracticeConnection();

        // Determine query type
        $queryType = 'UNKNOWN';
        if (preg_match('/^\s*(SELECT|SHOW|DESCRIBE|EXPLAIN)\b/i', $sql, $matches)) {
            $queryType = strtoupper($matches[1]);
        } elseif (preg_match('/^\s*(INSERT|UPDATE|DELETE)\b/i', $sql, $matches)) {
            $queryType = strtoupper($matches[1]);
        } elseif (preg_match('/^\s*(CREATE|ALTER|DROP|TRUNCATE)\b/i', $sql, $matches)) {
            $queryType = strtoupper($matches[1]);
        }

        $isSelectLike = in_array($queryType, ['SELECT', 'SHOW', 'DESCRIBE', 'EXPLAIN'], true);

        try {
            $stmt = $pdo->query($sql);
            $executionTimeMs = round((microtime(true) - $startTime) * 1000, 2);

            $columns = [];
            $rows = [];
            $rowCount = 0;

            if ($isSelectLike && $stmt !== false) {
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                $rowCount = count($rows);
                if ($rowCount > 0) {
                    $columns = array_keys($rows[0]);
                }
            } else {
                $rowCount = $stmt ? $stmt->rowCount() : 0;
            }

            // Record history in core database
            self::logHistory((int)$user['id'], $sql, $queryType, 1, $rowCount, $executionTimeMs, null);

            AuthMiddleware::jsonResponse([
                'success' => true,
                'query_type' => $queryType,
                'columns' => $columns,
                'rows' => $rows,
                'rows_affected' => $rowCount,
                'execution_time_ms' => $executionTimeMs,
                'message' => $isSelectLike ? "Returned {$rowCount} row(s)" : "Query OK, {$rowCount} row(s) affected."
            ]);
        } catch (\PDOException $e) {
            $executionTimeMs = round((microtime(true) - $startTime) * 1000, 2);
            $errorMessage = $e->getMessage();

            // Sanitize error message to avoid exposing raw system paths
            $cleanError = preg_replace('/SQLSTATE\[.*?\]:\s*/', '', $errorMessage);

            self::logHistory((int)$user['id'], $sql, $queryType, 0, 0, $executionTimeMs, $cleanError);

            AuthMiddleware::jsonResponse([
                'success' => false,
                'error' => $cleanError,
                'query_type' => $queryType,
                'execution_time_ms' => $executionTimeMs
            ], 400);
        }
    }

    /**
     * GET /api/v1/sql/schema
     * Returns relational schema structure, columns, types, PKs, and row counts.
     */
    public static function getSchema(): void {
        $database = $_GET['database'] ?? 'practice';
        $pdo = ($database === 'core') ? Database::getCoreConnection() : Database::getPracticeConnection();
        $dbName = ($database === 'core') ? 'timecredit_db' : 'timecredit_practice';

        $isPgsql = ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'pgsql');

        try {
            // Get all tables
            if ($isPgsql) {
                $tablesStmt = $pdo->prepare("
                    SELECT table_name, table_type
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                    ORDER BY table_name ASC
                ");
                $tablesStmt->execute();
            } else {
                $tablesStmt = $pdo->prepare('
                    SELECT table_name, table_type, table_rows
                    FROM information_schema.tables
                    WHERE table_schema = :dbname
                    ORDER BY table_name ASC
                ');
                $tablesStmt->execute(['dbname' => $dbName]);
            }
            $rawTables = $tablesStmt->fetchAll();

            $schema = [];
            foreach ($rawTables as $t) {
                $tableName = $t['table_name'];

                // Filter out password tables or sensitive audit logs in practice viewer if needed
                if ($database === 'core' && $tableName === 'users') {
                    // Allowed but password_hash column is excluded below
                }

                // Get columns
                if ($isPgsql) {
                    $colStmt = $pdo->prepare("
                        SELECT c.column_name, c.data_type, c.is_nullable, c.column_default,
                               CASE WHEN tc.constraint_type = 'PRIMARY KEY' THEN 'PRI' ELSE '' END AS column_key,
                               '' AS extra
                        FROM information_schema.columns c
                        LEFT JOIN information_schema.key_column_usage kcu 
                            ON c.table_schema = kcu.table_schema AND c.table_name = kcu.table_name AND c.column_name = kcu.column_name
                        LEFT JOIN information_schema.table_constraints tc 
                            ON kcu.table_schema = tc.table_schema AND kcu.table_name = tc.table_name AND kcu.constraint_name = tc.constraint_name AND tc.constraint_type = 'PRIMARY KEY'
                        WHERE c.table_schema = 'public' AND c.table_name = :tbl
                        ORDER BY c.ordinal_position ASC
                    ");
                    $colStmt->execute(['tbl' => $tableName]);
                } else {
                    $colStmt = $pdo->prepare('
                        SELECT column_name, data_type, is_nullable, column_key, column_default, extra
                        FROM information_schema.columns
                        WHERE table_schema = :dbname AND table_name = :tbl
                        ORDER BY ordinal_position ASC
                    ');
                    $colStmt->execute(['dbname' => $dbName, 'tbl' => $tableName]);
                }
                $cols = $colStmt->fetchAll();

                // Get real count safely
                $safeTable = preg_replace('/[^a-zA-Z0-9_]/', '', $tableName);
                $countStmt = $pdo->query("SELECT COUNT(*) AS cnt FROM {$safeTable}");
                $exactCount = $countStmt ? (int)$countStmt->fetch()['cnt'] : 0;

                $schema[] = [
                    'table_name' => $tableName,
                    'type' => $t['table_type'],
                    'row_count' => $exactCount,
                    'columns' => array_map(function ($col) {
                        return [
                            'name' => $col['column_name'],
                            'type' => $col['data_type'],
                            'nullable' => $col['is_nullable'] === 'YES',
                            'is_pk' => ($col['column_key'] ?? '') === 'PRI',
                            'is_fk' => ($col['column_key'] ?? '') === 'MUL',
                            'extra' => $col['extra'] ?? '',
                        ];
                    }, $cols)
                ];
            }

            AuthMiddleware::jsonResponse([
                'database' => $isPgsql ? 'neondb (PostgreSQL)' : $dbName,
                'tables' => $schema
            ]);
        } catch (\Exception $e) {
            AuthMiddleware::jsonResponse(['error' => 'Failed to fetch schema metadata: ' . $e->getMessage()], 500);
        }
    }

    /**
     * POST /api/v1/sql/reset
     * Resets the controlled practice database to clean initial seed data.
     */
    public static function resetPracticeDatabase(): void {
        AuthMiddleware::requireAuth();
        $practiceSqlPath = __DIR__ . '/../../database/practice-schema.sql';

        if (!file_exists($practiceSqlPath)) {
            AuthMiddleware::jsonResponse(['error' => 'Practice schema template not found.'], 500);
            return;
        }

        $sqlContent = file_get_contents($practiceSqlPath);
        $pdo = Database::getPracticeConnection();

        try {
            $pdo->exec($sqlContent);
            AuthMiddleware::jsonResponse(['message' => 'Controlled SQL practice database has been successfully reset to initial seed state.']);
        } catch (\PDOException $e) {
            AuthMiddleware::jsonResponse(['error' => 'Reset failed: ' . $e->getMessage()], 500);
        }
    }

    /**
     * GET /api/v1/sql/saved-queries
     */
    public static function getSavedQueries(): void {
        $user = AuthMiddleware::requireAuth();
        $pdo = Database::getCoreConnection();

        $stmt = $pdo->prepare('
            SELECT id, title, sql_text, description, created_at, updated_at
            FROM saved_queries
            WHERE user_id = :uid OR user_id = 1
            ORDER BY created_at DESC
        ');
        $stmt->execute(['uid' => $user['id']]);
        AuthMiddleware::jsonResponse(['saved_queries' => $stmt->fetchAll()]);
    }

    /**
     * POST /api/v1/sql/saved-queries
     */
    public static function saveQuery(): void {
        $user = AuthMiddleware::requireAuth();
        $input = AuthMiddleware::getJsonInput();

        $title = trim($input['title'] ?? '');
        $sqlText = trim($input['sql_text'] ?? '');
        $description = trim($input['description'] ?? '');

        if (empty($title) || empty($sqlText)) {
            AuthMiddleware::jsonResponse(['error' => 'Title and SQL query text are required.'], 422);
            return;
        }

        $pdo = Database::getCoreConnection();
        $stmt = $pdo->prepare('
            INSERT INTO saved_queries (user_id, title, sql_text, description)
            VALUES (:uid, :title, :sql, :desc)
        ');
        $stmt->execute([
            'uid' => $user['id'],
            'title' => $title,
            'sql' => $sqlText,
            'desc' => $description
        ]);

        AuthMiddleware::jsonResponse(['message' => 'Query saved successfully', 'id' => Database::getLastInsertId($pdo, 'saved_queries')], 201);
    }

    /**
     * GET /api/v1/sql/history
     */
    public static function getHistory(): void {
        $user = AuthMiddleware::requireAuth();
        $pdo = Database::getCoreConnection();

        $stmt = $pdo->prepare('
            SELECT id, query_text, query_type, success, rows_affected, execution_time_ms, error_message, created_at
            FROM query_history
            WHERE user_id = :uid
            ORDER BY created_at DESC
            LIMIT 30
        ');
        $stmt->execute(['uid' => $user['id']]);
        AuthMiddleware::jsonResponse(['history' => $stmt->fetchAll()]);
    }

    /**
     * Internal helper to record query execution in audit history.
     */
    private static function logHistory(int $userId, string $sql, string $type, int $success, int $rows, float $timeMs, ?string $error): void {
        try {
            $pdo = Database::getCoreConnection();
            $stmt = $pdo->prepare('
                INSERT INTO query_history (user_id, query_text, query_type, success, rows_affected, execution_time_ms, error_message)
                VALUES (:uid, :sql, :type, :success, :rows, :time_ms, :err)
            ');
            $stmt->execute([
                'uid' => $userId,
                'sql' => $sql,
                'type' => $type,
                'success' => $success,
                'rows' => $rows,
                'time_ms' => $timeMs,
                'err' => $error
            ]);
        } catch (\Throwable $t) {
            // Silently ignore history logging errors so as not to break student query execution
        }
    }
}
