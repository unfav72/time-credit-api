<?php
declare(strict_types=1);

namespace TimeCredit\Controllers;

use PDO;
use TimeCredit\Middleware\AuthMiddleware;
use TimeCredit\Repositories\Database;

class WalletController {
    /**
     * GET /api/v1/wallet
     */
    public static function getWallet(): void {
        $user = AuthMiddleware::requireAuth();
        $pdo = Database::getCoreConnection();

        // Account info
        $stmt = $pdo->prepare('
            SELECT id, user_id, balance, updated_at
            FROM credit_accounts
            WHERE user_id = :uid
            LIMIT 1
        ');
        $stmt->execute(['uid' => $user['id']]);
        $account = $stmt->fetch();

        if (!$account) {
            // Auto initialize if missing
            $ins = $pdo->prepare('INSERT INTO credit_accounts (user_id, balance) VALUES (:uid, 2.00)');
            $ins->execute(['uid' => $user['id']]);
            $accountId = Database::getLastInsertId($pdo, 'credit_accounts');
            $account = ['id' => $accountId, 'user_id' => $user['id'], 'balance' => 2.00, 'updated_at' => date('Y-m-d H:i:s')];
        }

        $accountId = (int)$account['id'];

        // Aggregate statistics from ledger
        $statsStmt = $pdo->prepare("
            SELECT 
                COALESCE(SUM(CASE WHEN entry_type = 'CREDIT' THEN amount ELSE 0 END), 0) AS total_earned,
                COALESCE(SUM(CASE WHEN entry_type = 'DEBIT' THEN amount ELSE 0 END), 0) AS total_spent,
                COUNT(id) AS total_transactions
            FROM credit_ledger_entries
            WHERE account_id = :acc_id
        ");
        $statsStmt->execute(['acc_id' => $accountId]);
        $stats = $statsStmt->fetch();

        // Recent ledger entries
        $ledgerStmt = $pdo->prepare('
            SELECT le.id, le.entry_type, le.amount, le.created_at,
                   ct.transaction_type, ct.idempotency_key,
                   ct.session_id, so.title AS session_title
            FROM credit_ledger_entries le
            JOIN credit_transactions ct ON le.transaction_id = ct.id
            LEFT JOIN sessions s ON ct.session_id = s.id
            LEFT JOIN service_requests sr ON s.request_id = sr.id
            LEFT JOIN service_offers so ON sr.offer_id = so.id
            WHERE le.account_id = :acc_id
            ORDER BY le.created_at DESC
            LIMIT 50
        ');
        $ledgerStmt->execute(['acc_id' => $accountId]);
        $transactions = $ledgerStmt->fetchAll();

        AuthMiddleware::jsonResponse([
            'balance' => (float)$account['balance'],
            'total_earned' => (float)$stats['total_earned'],
            'total_spent' => (float)$stats['total_spent'],
            'total_transactions' => (int)$stats['total_transactions'],
            'transactions' => $transactions
        ]);
    }
}
