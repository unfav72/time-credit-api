<?php
declare(strict_types=1);

/**
 * TimeCredit Live - Database Migration CLI Runner
 * Executes version-controlled SQL migrations against PostgreSQL / MySQL.
 */

require_once __DIR__ . '/../config/database.php';

// Robust autoloader for TimeCredit namespace (supports Linux case-sensitive filesystems)
spl_autoload_register(function ($class) {
    $prefix = 'TimeCredit\\';
    $baseDir = __DIR__ . '/../src/';
    $len = strlen($prefix);
    if (strncmp($prefix, $class, $len) !== 0) return;
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

use TimeCredit\Repositories\Database;

echo "\n=======================================================\n";
echo "  TIMECREDIT LIVE — DATABASE MIGRATION RUNNER\n";
echo "=======================================================\n\n";

try {
    $pdo = Database::getCoreConnection();
    $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
    echo "Connected to Database via driver: [{$driver}]\n";

    // 1. Create migrations tracking table
    if ($driver === 'pgsql') {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id SERIAL PRIMARY KEY,
                migration VARCHAR(255) NOT NULL UNIQUE,
                applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        ");
    } elseif ($driver === 'sqlite') {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                migration VARCHAR(255) NOT NULL UNIQUE,
                applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        ");
    } else {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                migration VARCHAR(255) NOT NULL UNIQUE,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB;
        ");
    }

    // 2. Fetch already applied migrations
    $appliedStmt = $pdo->query("SELECT migration FROM schema_migrations");
    $applied = $appliedStmt->fetchAll(PDO::FETCH_COLUMN);

    // 3. Scan migrations directory
    $migrationsDir = __DIR__ . '/../database/migrations';
    $files = glob($migrationsDir . '/*.sql');
    sort($files);

    if (empty($files)) {
        echo "No migration files found in: {$migrationsDir}\n";
        exit(0);
    }

    $appliedCount = 0;
    foreach ($files as $file) {
        $filename = basename($file);
        if (in_array($filename, $applied, true)) {
            echo "  [ALREADY APPLIED] {$filename}\n";
            continue;
        }

        echo "  [APPLYING] {$filename} ... ";
        $sql = file_get_contents($file);

        // Execute migration
        $pdo->exec($sql);

        // Record in tracking table
        $recordStmt = $pdo->prepare("INSERT INTO schema_migrations (migration) VALUES (:mig)");
        $recordStmt->execute(['mig' => $filename]);

        echo "\033[32mDONE\033[0m\n";
        $appliedCount++;
    }

    echo "\nMigration process completed. {$appliedCount} new migrations applied.\n";
} catch (\Throwable $e) {
    echo "\n\033[31m[ERROR] Migration failed:\033[0m " . $e->getMessage() . "\n";
    echo "In " . $e->getFile() . " on line " . $e->getLine() . "\n";
    exit(1);
}
