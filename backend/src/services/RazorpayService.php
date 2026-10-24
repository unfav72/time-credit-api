<?php
declare(strict_types=1);

namespace TimeCredit\Services;

use PDO;
use RuntimeException;
use TimeCredit\Repositories\Database;

class RazorpayService {
    /**
     * Authoritative Server-Controlled Packages
     * 1 TimeCredit = 15 minutes of learning time.
     */
    public const PACKAGES = [
        'starter' => [
            'id' => 'starter',
            'name' => 'Starter',
            'credits' => 10,
            'price_inr' => 27,
            'amount_paise' => 2700,
            'learning_minutes' => 150,
            'badge' => 'Intro Pack',
            'popular' => false,
        ],
        'standard' => [
            'id' => 'standard',
            'name' => 'Plus',
            'credits' => 20,
            'price_inr' => 52,
            'amount_paise' => 5200,
            'learning_minutes' => 300,
            'badge' => 'Most Popular',
            'popular' => true,
        ],
        'plus' => [
            'id' => 'plus',
            'name' => 'Plus',
            'credits' => 20,
            'price_inr' => 52,
            'amount_paise' => 5200,
            'learning_minutes' => 300,
            'badge' => 'Most Popular',
            'popular' => true,
        ],
        'premium' => [
            'id' => 'premium',
            'name' => 'Pro',
            'credits' => 30,
            'price_inr' => 75,
            'amount_paise' => 7500,
            'learning_minutes' => 450,
            'badge' => 'Best Value',
            'popular' => false,
        ],
        'pro' => [
            'id' => 'pro',
            'name' => 'Pro',
            'credits' => 30,
            'price_inr' => 75,
            'amount_paise' => 7500,
            'learning_minutes' => 450,
            'badge' => 'Best Value',
            'popular' => false,
        ],
    ];

    public static function getPackages(): array {
        return self::PACKAGES;
    }

    public static function getKeyId(): string {
        return getenv('RAZORPAY_KEY_ID') ?: 'rzp_test_TrFi6LyCzcSU8k';
    }

    public static function getKeySecret(): string {
        return getenv('RAZORPAY_KEY_SECRET') ?: 'WduRtA2i4mvCeNt4DfobW8cC';
    }

    public static function getWebhookSecret(): string {
        return getenv('RAZORPAY_WEBHOOK_SECRET') ?: 'whsec_TimeCreditLive2026_test';
    }

    /**
     * Get package by ID or null.
     */
    public static function getPackage(string $packageId): ?array {
        return self::PACKAGES[$packageId] ?? null;
    }

    /**
     * Create a Razorpay Order through the server-side API.
     */
    public static function createRazorpayOrder(string $packageId, int $userId): array {
        $package = self::getPackage($packageId);
        if (!$package) {
            throw new RuntimeException('Invalid top-up package selected.');
        }

        $pdo = Database::getCoreConnection();
        $receipt = 'rcpt_' . $userId . '_' . time() . '_' . bin2hex(random_bytes(3));
        $amountPaise = $package['amount_paise'];
        $currency = 'INR';

        $keyId = self::getKeyId();
        $keySecret = self::getKeySecret();

        $razorpayOrderId = '';

        // Attempt Razorpay API order creation
        $ch = curl_init('https://api.razorpay.com/v1/orders');
        $payload = json_encode([
            'amount' => $amountPaise,
            'currency' => $currency,
            'receipt' => $receipt,
            'notes' => [
                'package_id' => $packageId,
                'user_id' => (string)$userId,
                'credits' => (string)$package['credits']
            ]
        ]);

        curl_setopt($ch, CURLOPT_USERPWD, "{$keyId}:{$keySecret}");
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 12);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr = curl_error($ch);
        curl_close($ch);

        if ($httpCode === 200 || $httpCode === 201) {
            $decoded = json_decode((string)$response, true);
            $razorpayOrderId = $decoded['id'] ?? '';
        } else {
            $decoded = json_decode((string)$response, true);
            $errMsg = $decoded['error']['description'] ?? $curlErr ?? 'Razorpay API returned HTTP ' . $httpCode;
            
            // In local/test development, allow simulated order if keys are offline/unreachable
            if (getenv('APP_ENV') !== 'production' && (empty($keyId) || str_contains($keyId, 'test'))) {
                error_log("Razorpay API Warning in development mode ({$httpCode}): {$errMsg}. Creating test order.");
                $razorpayOrderId = 'order_test_' . bin2hex(random_bytes(7));
            } else {
                throw new RuntimeException("Razorpay Order Creation Failed ({$httpCode}): {$errMsg}");
            }
        }

        if (empty($razorpayOrderId)) {
            $razorpayOrderId = 'order_test_' . bin2hex(random_bytes(7));
        }

        // Store topup order in database
        $internalOrderId = Database::insertAndGetId($pdo, "
            INSERT INTO credit_topup_orders 
                (user_id, package_id, credits, amount_paise, currency, razorpay_order_id, status)
            VALUES 
                (:user_id, :pkg, :credits, :amount, :cur, :rzp_order_id, 'CREATED')
        ", [
            'user_id' => $userId,
            'pkg' => $packageId,
            'credits' => $package['credits'],
            'amount' => $amountPaise,
            'cur' => $currency,
            'rzp_order_id' => $razorpayOrderId
        ]);

        return [
            'internal_order_id' => $internalOrderId,
            'razorpay_order_id' => $razorpayOrderId,
            'key_id' => $keyId,
            'amount_paise' => $amountPaise,
            'currency' => $currency,
            'package' => $package
        ];
    }

    /**
     * Verify payment signature using HMAC-SHA256 with constant-time comparison.
     */
    public static function verifySignature(string $razorpayOrderId, string $razorpayPaymentId, string $signature): bool {
        $secret = self::getKeySecret();
        $generated = hash_hmac('sha256', $razorpayOrderId . '|' . $razorpayPaymentId, $secret);
        
        // Also allow test mock signatures in development mode
        if (getenv('APP_ENV') !== 'production' && str_starts_with($signature, 'test_mock_sig_')) {
            return true;
        }

        return hash_equals($generated, $signature);
    }

    /**
     * Reusable atomic credit fulfillment service.
     * Enforces strict ACID properties, row locking, and idempotent fulfillment.
     */
    public static function fulfillSuccessfulTopup(string $razorpayOrderId, string $razorpayPaymentId): array {
        $pdo = Database::getCoreConnection();
        $pdo->beginTransaction();

        try {
            // 1. Lock top-up order row
            $stmt = $pdo->prepare('
                SELECT * FROM credit_topup_orders 
                WHERE razorpay_order_id = :rzp_order_id 
                FOR UPDATE
            ');
            $stmt->execute(['rzp_order_id' => $razorpayOrderId]);
            $order = $stmt->fetch();

            if (!$order) {
                $pdo->rollBack();
                throw new RuntimeException('Top-up order not found for order ID: ' . $razorpayOrderId);
            }

            // 2. Check if already fulfilled
            if ($order['status'] === 'PAID' && !empty($order['fulfilled_at'])) {
                // Fetch current balance to return safely
                $balStmt = $pdo->prepare('SELECT balance FROM credit_accounts WHERE user_id = :uid');
                $balStmt->execute(['uid' => $order['user_id']]);
                $bal = (float)$balStmt->fetchColumn();

                $pdo->commit();
                return [
                    'already_fulfilled' => true,
                    'credits_added' => (float)$order['credits'],
                    'new_balance' => $bal,
                    'order_id' => $order['id']
                ];
            }

            $userId = (int)$order['user_id'];
            $creditsToAdd = (float)$order['credits'];
            $packageId = $order['package_id'];

            // 3. Lock user credit account row
            $accStmt = $pdo->prepare('
                SELECT id, balance FROM credit_accounts 
                WHERE user_id = :uid 
                FOR UPDATE
            ');
            $accStmt->execute(['uid' => $userId]);
            $acc = $accStmt->fetch();

            if (!$acc) {
                // Create account if not present
                $accountId = Database::insertAndGetId($pdo, 'INSERT INTO credit_accounts (user_id, balance) VALUES (:uid, 0.00)', ['uid' => $userId]);
                $currentBalance = 0.00;
            } else {
                $accountId = (int)$acc['id'];
                $currentBalance = (float)$acc['balance'];
            }

            // 4. Update order status to PAID
            $updOrder = $pdo->prepare("
                UPDATE credit_topup_orders 
                SET status = 'PAID',
                    razorpay_payment_id = :pay_id,
                    paid_at = NOW(),
                    fulfilled_at = NOW()
                WHERE id = :id
            ");
            $updOrder->execute([
                'pay_id' => $razorpayPaymentId,
                'id' => $order['id']
            ]);

            // 5. Insert master credit transaction
            $idempotencyKey = 'TOPUP_' . $order['id'] . '_' . $razorpayOrderId;
            $txnId = Database::insertAndGetId($pdo, "
                INSERT INTO credit_transactions 
                    (session_id, topup_order_id, idempotency_key, transaction_type, status)
                VALUES 
                    (NULL, :topup_id, :key, 'PURCHASE', 'COMMITTED')
            ", [
                'topup_id' => $order['id'],
                'key' => $idempotencyKey
            ]);

            // 6. Insert credit ledger entry (CREDIT)
            $ledger = $pdo->prepare("
                INSERT INTO credit_ledger_entries 
                    (transaction_id, account_id, entry_type, amount)
                VALUES 
                    (:txn_id, :acc_id, 'CREDIT', :amount)
            ");
            $ledger->execute([
                'txn_id' => $txnId,
                'acc_id' => $accountId,
                'amount' => $creditsToAdd
            ]);

            // 7. Update user balance in credit_accounts
            $newBalance = round($currentBalance + $creditsToAdd, 2);
            $updBal = $pdo->prepare('UPDATE credit_accounts SET balance = :new_bal WHERE id = :acc_id');
            $updBal->execute(['new_bal' => $newBalance, 'acc_id' => $accountId]);

            // 8. Add user notification
            $notif = $pdo->prepare('
                INSERT INTO notifications (user_id, title, message)
                VALUES (:uid, :title, :msg)
            ');
            $notif->execute([
                'uid' => $userId,
                'title' => 'TimeCredits Top-Up Successful!',
                'msg' => sprintf('Your %s package top-up was completed. +%.2f TimeCredits added to your wallet.', ucfirst($packageId), $creditsToAdd)
            ]);

            $pdo->commit();

            return [
                'already_fulfilled' => false,
                'credits_added' => $creditsToAdd,
                'new_balance' => $newBalance,
                'order_id' => (int)$order['id']
            ];
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }
}
