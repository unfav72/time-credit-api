<?php
declare(strict_types=1);

namespace TimeCredit\Controllers;

use PDO;
use TimeCredit\Middleware\AuthMiddleware;
use TimeCredit\Repositories\Database;
use TimeCredit\Services\RazorpayService;

class PaymentController {
    /**
     * GET /api/v1/topup/packages
     */
    public static function getPackages(): void {
        AuthMiddleware::jsonResponse([
            'packages' => array_values(RazorpayService::PACKAGES),
            'conversion_rule' => '1 TimeCredit = 15 minutes of learning time',
            'currency' => 'INR'
        ]);
    }

    /**
     * POST /api/v1/payments/create-order
     */
    public static function createOrder(): void {
        $user = AuthMiddleware::requireAuth();
        $input = AuthMiddleware::getJsonInput();

        $packageId = trim($input['package_id'] ?? '');
        if (empty($packageId) || !isset(RazorpayService::PACKAGES[$packageId])) {
            AuthMiddleware::jsonResponse([
                'error' => 'Invalid package selected. Please choose from Starter, Standard, or Premium.'
            ], 422);
            return;
        }

        try {
            $orderData = RazorpayService::createRazorpayOrder($packageId, (int)$user['id']);

            AuthMiddleware::jsonResponse([
                'success' => true,
                'order' => [
                    'internal_order_id' => $orderData['internal_order_id'],
                    'razorpay_order_id' => $orderData['razorpay_order_id'],
                    'key_id' => $orderData['key_id'],
                    'amount_paise' => $orderData['amount_paise'],
                    'currency' => $orderData['currency'],
                    'package' => $orderData['package']
                ]
            ], 201);
        } catch (\Throwable $e) {
            AuthMiddleware::jsonResponse(['error' => 'Failed to create payment order: ' . $e->getMessage()], 500);
        }
    }

    /**
     * POST /api/v1/payments/verify
     */
    public static function verifyPayment(): void {
        $user = AuthMiddleware::requireAuth();
        $input = AuthMiddleware::getJsonInput();

        $orderId = trim($input['razorpay_order_id'] ?? '');
        $paymentId = trim($input['razorpay_payment_id'] ?? '');
        $signature = trim($input['razorpay_signature'] ?? '');

        if (empty($orderId) || empty($paymentId) || empty($signature)) {
            AuthMiddleware::jsonResponse([
                'error' => 'Missing required payment verification parameters.'
            ], 422);
            return;
        }

        $pdo = Database::getCoreConnection();

        // 1. Check order ownership
        $stmt = $pdo->prepare('SELECT * FROM credit_topup_orders WHERE razorpay_order_id = :ord');
        $stmt->execute(['ord' => $orderId]);
        $order = $stmt->fetch();

        if (!$order) {
            AuthMiddleware::jsonResponse(['error' => 'Top-up order not found.'], 404);
            return;
        }

        if ((int)$order['user_id'] !== (int)$user['id']) {
            AuthMiddleware::jsonResponse(['error' => 'Unauthorized: Payment order does not belong to you.'], 403);
            return;
        }

        // 2. Verify signature
        if (!RazorpayService::verifySignature($orderId, $paymentId, $signature)) {
            // Update order status to FAILED
            $pdo->prepare("UPDATE credit_topup_orders SET status = 'FAILED' WHERE id = :id")
                ->execute(['id' => $order['id']]);

            AuthMiddleware::jsonResponse(['error' => 'Invalid payment signature. Verification rejected.'], 400);
            return;
        }

        // 3. Fulfill atomically
        try {
            $fulfillment = RazorpayService::fulfillSuccessfulTopup($orderId, $paymentId);

            AuthMiddleware::jsonResponse([
                'success' => true,
                'message' => 'Payment verified and TimeCredits added successfully!',
                'credits_added' => $fulfillment['credits_added'],
                'new_balance' => $fulfillment['new_balance'],
                'payment_id' => $paymentId,
                'order_id' => $orderId
            ]);
        } catch (\Throwable $e) {
            AuthMiddleware::jsonResponse(['error' => 'Fulfillment failed: ' . $e->getMessage()], 500);
        }
    }

    /**
     * GET /api/v1/payments/history
     */
    public static function getHistory(): void {
        $user = AuthMiddleware::requireAuth();
        $pdo = Database::getCoreConnection();

        $stmt = $pdo->prepare('
            SELECT 
                id, package_id, credits, amount_paise, currency,
                razorpay_order_id, razorpay_payment_id, status,
                created_at, paid_at, fulfilled_at
            FROM credit_topup_orders
            WHERE user_id = :uid
            ORDER BY created_at DESC
        ');
        $stmt->execute(['uid' => $user['id']]);
        $orders = $stmt->fetchAll();

        // Format for display
        $formatted = array_map(function ($ord) {
            $pkg = RazorpayService::getPackage($ord['package_id']);
            return [
                'id' => (int)$ord['id'],
                'package_id' => $ord['package_id'],
                'package_name' => $pkg ? $pkg['name'] : ucfirst($ord['package_id']),
                'credits' => (float)$ord['credits'],
                'amount_inr' => round($ord['amount_paise'] / 100.0, 2),
                'amount_paise' => (int)$ord['amount_paise'],
                'currency' => $ord['currency'],
                'status' => $ord['status'],
                'razorpay_order_id' => $ord['razorpay_order_id'],
                'razorpay_payment_id' => $ord['razorpay_payment_id'],
                'created_at' => $ord['created_at'],
                'paid_at' => $ord['paid_at']
            ];
        }, $orders);

        AuthMiddleware::jsonResponse(['history' => $formatted]);
    }

    /**
     * POST /api/v1/payments/webhook
     */
    public static function webhook(): void {
        $rawPayload = file_get_contents('php://input');
        $signature = $_SERVER['HTTP_X_RAZORPAY_SIGNATURE'] ?? '';

        $webhookSecret = RazorpayService::getWebhookSecret();
        $expectedSignature = hash_hmac('sha256', $rawPayload, $webhookSecret);

        if (!hash_equals($expectedSignature, $signature)) {
            AuthMiddleware::jsonResponse(['error' => 'Invalid webhook signature'], 400);
            return;
        }

        $data = json_decode($rawPayload, true);
        $eventId = $data['id'] ?? '';
        $eventType = $data['event'] ?? '';

        if (empty($eventId) || empty($eventType)) {
            AuthMiddleware::jsonResponse(['error' => 'Malformed webhook payload'], 400);
            return;
        }

        $pdo = Database::getCoreConnection();

        // 1. Check idempotency on event ID
        $chk = $pdo->prepare('SELECT id, processing_status FROM payment_webhook_events WHERE provider_event_id = :eid');
        $chk->execute(['eid' => $eventId]);
        $existingEvent = $chk->fetch();

        if ($existingEvent) {
            AuthMiddleware::jsonResponse(['status' => 'duplicate_event_already_handled']);
            return;
        }

        // Record event
        $ins = $pdo->prepare("
            INSERT INTO payment_webhook_events (provider_event_id, event_type, processing_status, payload)
            VALUES (:eid, :etype, 'PENDING', :payload)
        ");
        $ins->execute([
            'eid' => $eventId,
            'etype' => $eventType,
            'payload' => $rawPayload
        ]);

        // Process payment captured or order paid
        if ($eventType === 'payment.captured' || $eventType === 'order.paid') {
            $paymentObj = $data['payload']['payment']['entity'] ?? null;
            $orderId = $paymentObj['order_id'] ?? '';
            $paymentId = $paymentObj['id'] ?? '';

            if (!empty($orderId) && !empty($paymentId)) {
                try {
                    RazorpayService::fulfillSuccessfulTopup($orderId, $paymentId);
                    $pdo->prepare("UPDATE payment_webhook_events SET processing_status = 'PROCESSED', processed_at = NOW() WHERE provider_event_id = :eid")
                        ->execute(['eid' => $eventId]);
                } catch (\Throwable $e) {
                    $pdo->prepare("UPDATE payment_webhook_events SET processing_status = 'FAILED' WHERE provider_event_id = :eid")
                        ->execute(['eid' => $eventId]);
                }
            }
        }

        AuthMiddleware::jsonResponse(['status' => 'success']);
    }
}
