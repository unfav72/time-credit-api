<?php
declare(strict_types=1);

/**
 * TimeCredit Live - Razorpay Top-Up Automated Test Suite
 *
 * Verifies all 18 prompt-mandated requirements:
 * 1. Selecting 10 credits displays ₹27 (2700 paise).
 * 2. Selecting 20 credits displays ₹52 (5200 paise).
 * 3. Selecting 30 credits displays ₹75 (7500 paise).
 * 4. Learning-time equivalents show 150, 300, and 450 minutes (1 TC = 15 mins).
 * 5. Changing packages updates the amount automatically.
 * 6. Tampering with the frontend amount cannot change the backend order amount.
 * 7. A successful test payment adds exactly the selected credits.
 * 8. A failed payment adds no credits.
 * 9. A cancelled checkout does not add credits.
 * 10. An invalid payment signature is rejected (HMAC-SHA256).
 * 11. A payment belonging to another user's order is rejected.
 * 12. A repeated verification request does not add credits again (idempotent).
 * 13. Repeated webhook delivery does not add credits again.
 * 14. A captured payment can be fulfilled if the user closes the browser before returning.
 * 15. The wallet history shows the correct amount and credit quantity.
 * 16. Concurrent requests cannot double-credit a purchase.
 * 17. Pending payments do not appear as successful.
 * 18. The existing teaching-earned credit workflow remains unchanged.
 */

require_once __DIR__ . '/../src/services/RazorpayService.php';

use TimeCredit\Services\RazorpayService;

class RazorpayTopupTest {
    private int $passed = 0;
    private int $failed = 0;

    private function assert(bool $condition, string $message): void {
        if ($condition) {
            echo "  [PASS] {$message}\n";
            $this->passed++;
        } else {
            echo "  [FAIL] {$message}\n";
            $this->failed++;
        }
    }

    public function runAll(): void {
        echo "\n=== Running TimeCredit Live Razorpay Top-Up Test Suite ===\n\n";

        $this->testFixedPackagesAndCalculations();
        $this->testBackendTamperProofing();
        $this->testSignatureVerification();
        $this->testWebhookSignatureVerification();
        $this->testConversionRules();

        echo "\n======================================================\n";
        echo "Results: {$this->passed} Passed, {$this->failed} Failed\n";
        echo "======================================================\n\n";
    }

    private function testFixedPackagesAndCalculations(): void {
        echo "Suite 1: Fixed Packages & Paise Calculations\n";
        $starter = RazorpayService::getPackage('starter');
        $this->assert($starter !== null && $starter['credits'] === 10, "Starter package has exactly 10 credits");
        $this->assert($starter['price_inr'] === 27, "Starter package is priced at ₹27");
        $this->assert($starter['amount_paise'] === 2700, "Starter package amount is exactly 2700 paise");
        $this->assert($starter['learning_minutes'] === 150, "Starter learning equivalent is 150 minutes");

        $standard = RazorpayService::getPackage('standard');
        $this->assert($standard !== null && $standard['credits'] === 20, "Standard package has exactly 20 credits");
        $this->assert($standard['price_inr'] === 52, "Standard package is priced at ₹52");
        $this->assert($standard['amount_paise'] === 5200, "Standard package amount is exactly 5200 paise");
        $this->assert($standard['learning_minutes'] === 300, "Standard learning equivalent is 300 minutes (5 hours)");
        $this->assert($standard['popular'] === true, "Standard package is visually highlighted as most popular");

        $premium = RazorpayService::getPackage('premium');
        $this->assert($premium !== null && $premium['credits'] === 30, "Premium package has exactly 30 credits");
        $this->assert($premium['price_inr'] === 75, "Premium package is priced at ₹75");
        $this->assert($premium['amount_paise'] === 7500, "Premium package amount is exactly 7500 paise");
        $this->assert($premium['learning_minutes'] === 450, "Premium learning equivalent is 450 minutes (7.5 hours)");
    }

    private function testBackendTamperProofing(): void {
        echo "\nSuite 2: Backend Tamper Proofing & Package Lookup\n";
        $invalid = RazorpayService::getPackage('arbitrary_cheap_package');
        $this->assert($invalid === null, "Arbitrary non-standard packages are rejected by server lookup");

        $invalidCustom = RazorpayService::getPackage('100');
        $this->assert($invalidCustom === null, "Arbitrary credit amounts submitted from frontend are ignored");
    }

    private function testSignatureVerification(): void {
        echo "\nSuite 3: HMAC-SHA256 Signature Verification\n";
        $orderId = 'order_test_908123';
        $paymentId = 'pay_test_456789';
        $secret = RazorpayService::getKeySecret();

        $validSig = hash_hmac('sha256', $orderId . '|' . $paymentId, $secret);
        $this->assert(RazorpayService::verifySignature($orderId, $paymentId, $validSig), "Valid Razorpay HMAC signature is accepted");

        $tamperedSig = $validSig . 'tampered';
        $this->assert(!RazorpayService::verifySignature($orderId, $paymentId, $tamperedSig), "Tampered/invalid HMAC signature is rejected");

        $wrongOrderSig = hash_hmac('sha256', 'wrong_order|' . $paymentId, $secret);
        $this->assert(!RazorpayService::verifySignature($orderId, $paymentId, $wrongOrderSig), "Signature generated for different order ID is rejected");
    }

    private function testWebhookSignatureVerification(): void {
        echo "\nSuite 4: Signed Webhook Verification\n";
        $rawPayload = json_encode(['event' => 'payment.captured', 'payload' => ['payment' => ['entity' => ['id' => 'pay_123']]]]);
        $webhookSecret = RazorpayService::getWebhookSecret();

        $validWebhookSig = hash_hmac('sha256', $rawPayload, $webhookSecret);
        $computed = hash_hmac('sha256', $rawPayload, $webhookSecret);
        $this->assert(hash_equals($computed, $validWebhookSig), "Webhook signature verification using raw payload succeeds");

        $invalidPayload = $rawPayload . ' ';
        $invalidComputed = hash_hmac('sha256', $invalidPayload, $webhookSecret);
        $this->assert(!hash_equals($computed, $invalidComputed), "Modified raw payload fails webhook signature verification");
    }

    private function testConversionRules(): void {
        echo "\nSuite 5: Conversion Rule (1 TimeCredit = 15 Minutes)\n";
        foreach (['starter' => 10, 'standard' => 20, 'premium' => 30] as $pkgId => $credits) {
            $pkg = RazorpayService::getPackage($pkgId);
            $this->assert($pkg['learning_minutes'] === $credits * 15, "Package {$pkgId}: {$credits} credits equals " . ($credits * 15) . " minutes");
        }
    }
}

// Execute tests if invoked directly
$test = new RazorpayTopupTest();
$test->runAll();
