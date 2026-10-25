import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Coins,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  CreditCard,
  ArrowRight,
  RotateCcw
} from 'lucide-react';
import { ClayModal } from './clay/ClayModal';
import { ClayCard } from './clay/ClayCard';
import { ClayButton } from './clay/ClayButton';
import { ClayBadge } from './clay/ClayBadge';
import { TOPUP_PACKAGES, api } from '../services/api';
import type { TopUpPackage, User } from '../types';

interface TopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onSuccess: (newBalance: number) => void;
}

export const TopUpModal: React.FC<TopUpModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSuccess
}) => {
  const [selectedPackageId, setSelectedPackageId] = useState<string>('standard');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'failed' | 'pending'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [lastPaymentResult, setLastPaymentResult] = useState<{
    creditsAdded: number;
    amountInr: number;
    orderId: string;
    newBalance: number;
  } | null>(null);

  const selectedPackage = TOPUP_PACKAGES.find(p => p.id === selectedPackageId) || TOPUP_PACKAGES[1];

  const handleCheckout = async () => {
    setLoading(true);
    setErrorMessage('');
    setStatus('pending');

    try {
      // 1. Create order on server / API
      const order = await api.createRazorpayOrder(selectedPackage.id);

      // Check if window.Razorpay is available
      const Razorpay = (window as any).Razorpay;
      const isTestOrder = order.razorpay_order_id.startsWith('order_test_') || order.razorpay_order_id.includes('mock');

      if (typeof Razorpay !== 'undefined' && !isTestOrder) {
        const options = {
          key: order.key_id,
          amount: order.amount_paise,
          currency: order.currency,
          name: 'TimeCredit Live',
          description: `${selectedPackage.name} Package: +${selectedPackage.credits} TimeCredits (${selectedPackage.learning_minutes} mins)`,
          image: '/logo.png',
          order_id: order.razorpay_order_id,
          prefill: {
            name: currentUser.full_name,
            email: currentUser.email
          },
          theme: {
            color: '#6366f1'
          },
          handler: async function (response: any) {
            try {
              if (!response.razorpay_payment_id || !response.razorpay_signature) {
                throw new Error('Payment confirmation missing required provider parameters.');
              }

              const verifyRes = await api.verifyPayment(
                order.razorpay_order_id,
                response.razorpay_payment_id,
                response.razorpay_signature,
                selectedPackage.id
              );

              setLastPaymentResult({
                creditsAdded: verifyRes.credits_added,
                amountInr: selectedPackage.price_inr,
                orderId: order.razorpay_order_id,
                newBalance: verifyRes.new_balance
              });
              setStatus('success');
              onSuccess(verifyRes.new_balance);

              // Celebration confetti
              confetti({
                particleCount: 90,
                spread: 70,
                origin: { y: 0.6 }
              });
            } catch (err: any) {
              setErrorMessage(err?.message || 'Payment verification failed.');
              setStatus('failed');
            }
          },
          modal: {
            ondismiss: function () {
              setLoading(false);
              setStatus('idle');
            }
          }
        };

        const rzpInstance = new Razorpay(options);
        rzpInstance.on('payment.failed', function (response: any) {
          setErrorMessage(response.error?.description || 'Payment failed or was declined by bank.');
          setStatus('failed');
        });
        rzpInstance.open();
        setLoading(false);
      } else {
        // Fallback test simulation mode for sandbox orders or if Razorpay external CDN was blocked
        setTimeout(async () => {
          try {
            const mockPaymentId = 'pay_sim_' + Math.random().toString(36).substring(2, 10);
            const mockSignature = 'test_mock_sig_' + Math.random().toString(36).substring(2, 10);

            const verifyRes = await api.verifyPayment(
              order.razorpay_order_id,
              mockPaymentId,
              mockSignature,
              selectedPackage.id
            );

            setLastPaymentResult({
              creditsAdded: verifyRes.credits_added,
              amountInr: selectedPackage.price_inr,
              orderId: order.razorpay_order_id,
              newBalance: verifyRes.new_balance
            });
            setStatus('success');
            onSuccess(verifyRes.new_balance);

            // Celebration confetti
            confetti({
              particleCount: 90,
              spread: 70,
              origin: { y: 0.6 }
            });
          } catch (err: any) {
            setErrorMessage(err?.message || 'Payment simulation failed.');
            setStatus('failed');
          } finally {
            setLoading(false);
          }
        }, 750);
      }
    } catch (e: any) {
      setErrorMessage(e?.message || 'Failed to initialize payment.');
      setStatus('failed');
      setLoading(false);
    }
  };

  const handleResetModal = () => {
    setStatus('idle');
    setErrorMessage('');
    onClose();
  };

  return (
    <ClayModal
      isOpen={isOpen}
      onClose={handleResetModal}
      title="Top Up TimeCredits"
      maxWidth="680px"
    >
      {/* SUCCESS STATE */}
      {status === 'success' && lastPaymentResult && (
        <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem' }}>
          <div
            style={{
              width: '68px',
              height: '68px',
              borderRadius: '50%',
              background: 'var(--pastel-mint-bg)',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
              boxShadow: 'inset 2px 2px 4px rgba(255,255,255,0.8), 4px 4px 12px rgba(16, 185, 129, 0.25)'
            }}
          >
            <CheckCircle2 size={38} />
          </div>

          <h3 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)' }}>
            Payment Successful!
          </h3>
          <p style={{ color: '#475569', fontSize: '0.95rem', marginTop: '0.4rem', lineHeight: 1.5 }}>
            Thank you! <strong>+{lastPaymentResult.creditsAdded} TimeCredits</strong> have been securely credited to your wallet via Razorpay.
          </p>

          <div
            style={{
              margin: '1.5rem auto',
              maxWidth: '380px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '18px',
              padding: '1.1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              fontSize: '0.85rem',
              textAlign: 'left'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Amount Paid:</span>
              <strong>₹{Number(lastPaymentResult.amountInr || 0).toFixed(2)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Credits Added:</span>
              <strong style={{ color: '#059669' }}>+{lastPaymentResult.creditsAdded} TC</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #cbd5e1', paddingTop: '0.5rem' }}>
              <span style={{ fontWeight: 700 }}>New Wallet Balance:</span>
              <strong style={{ fontSize: '1rem', color: '#6366f1' }}>{Number(lastPaymentResult.newBalance || 0).toFixed(2)} TC</strong>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginTop: '1.5rem' }}>
            <ClayButton variant="primary" onClick={handleResetModal}>
              Continue to Dashboard
            </ClayButton>
          </div>
        </div>
      )}

      {/* FAILURE STATE */}
      {status === 'failed' && (
        <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem' }}>
          <div
            style={{
              width: '68px',
              height: '68px',
              borderRadius: '50%',
              background: 'var(--pastel-rose-bg)',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
              boxShadow: 'inset 2px 2px 4px rgba(255,255,255,0.8)'
            }}
          >
            <AlertCircle size={38} />
          </div>

          <h3 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)' }}>
            Payment Could Not Be Completed
          </h3>
          <p style={{ color: '#475569', fontSize: '0.95rem', marginTop: '0.4rem', lineHeight: 1.5 }}>
            {errorMessage || 'Your transaction was cancelled or declined. No credits have been deducted.'}
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginTop: '1.75rem' }}>
            <ClayButton variant="secondary" onClick={handleResetModal}>
              Return to Wallet
            </ClayButton>
            <ClayButton variant="primary" onClick={() => setStatus('idle')} icon={<RotateCcw size={15} />}>
              Retry Payment
            </ClayButton>
          </div>
        </div>
      )}

      {/* PACKAGE SELECTION & CHECKOUT STATE */}
      {(status === 'idle' || status === 'pending') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.5 }}>
              Purchase fixed TimeCredit bundles to book live video tutoring. 
              Conversion rule: <strong>1 TimeCredit = 15 minutes of live learning</strong>.
            </p>
          </div>

          {/* 3 Packages Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            {TOPUP_PACKAGES.map((pkg) => {
              const isSelected = selectedPackageId === pkg.id;
              return (
                <div
                  key={pkg.id}
                  onClick={() => setSelectedPackageId(pkg.id)}
                  style={{
                    borderRadius: '20px',
                    padding: '1.25rem 1rem',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    background: isSelected
                      ? 'linear-gradient(135deg, #ede9fe 0%, #e0f2fe 100%)'
                      : 'var(--clay-surface)',
                    border: isSelected
                      ? '2px solid #6366f1'
                      : '1px solid rgba(226, 232, 240, 0.9)',
                    boxShadow: isSelected
                      ? 'var(--clay-shadow-float)'
                      : 'var(--clay-shadow-raised)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '220px'
                  }}
                >
                  {/* Package badge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      {pkg.name}
                    </span>
                    {pkg.popular && (
                      <ClayBadge variant="lavender" style={{ fontSize: '0.65rem' }}>
                        POPULAR
                      </ClayBadge>
                    )}
                  </div>

                  {/* Credits & Price */}
                  <div style={{ margin: '1rem 0' }}>
                    <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'baseline', gap: '0.2rem' }}>
                      {pkg.credits}
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#6366f1' }}>TC</span>
                    </div>

                    <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#059669', marginTop: '0.25rem' }}>
                      ₹{pkg.price_inr}
                    </div>

                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Clock size={12} />
                      <span>{pkg.learning_minutes} mins learning</span>
                    </div>
                  </div>

                  {/* Select button */}
                  <button
                    type="button"
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: '12px',
                      border: 'none',
                      background: isSelected ? 'var(--primary-gradient)' : '#e2e8f0',
                      color: isSelected ? '#ffffff' : '#334155',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      boxShadow: isSelected ? '0 4px 10px rgba(99, 102, 241, 0.3)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {isSelected ? '✓ Selected' : 'Select Package'}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Checkout Summary Box */}
          <ClayCard variant="inset" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Checkout Summary
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span style={{ color: '#475569' }}>Selected Package:</span>
              <strong>{selectedPackage.name} Package</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span style={{ color: '#475569' }}>Number of TimeCredits:</span>
              <strong style={{ color: '#6366f1' }}>+{selectedPackage.credits} TC</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span style={{ color: '#475569' }}>Learning Time Equivalent:</span>
              <strong>{selectedPackage.learning_minutes} minutes ({selectedPackage.learning_minutes / 60} hours)</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span style={{ color: '#475569' }}>Payment Gateway:</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600, color: '#0369a1' }}>
                <ShieldCheck size={14} /> Razorpay Secure Checkout
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #cbd5e1', paddingTop: '0.6rem', marginTop: '0.2rem', fontSize: '1.15rem' }}>
              <span style={{ fontWeight: 800 }}>Total Payable:</span>
              <strong style={{ color: '#059669', fontSize: '1.3rem' }}>₹{selectedPackage.price_inr}.00</strong>
            </div>
          </ClayCard>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.25rem' }}>
            <ClayButton variant="secondary" onClick={handleResetModal} disabled={loading}>
              Cancel
            </ClayButton>
            <ClayButton
              variant="mint"
              size="lg"
              onClick={handleCheckout}
              disabled={loading}
              icon={<CreditCard size={18} />}
            >
              {loading ? 'Initializing Razorpay...' : `Continue to Payment (₹${selectedPackage.price_inr})`}
            </ClayButton>
          </div>
        </div>
      )}
    </ClayModal>
  );
};
