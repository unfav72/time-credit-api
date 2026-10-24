import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  CreditCard,
  CheckCircle2,
  Lock,
  PlusCircle,
  Clock,
  AlertCircle,
  RotateCcw
} from 'lucide-react';
import { ClayCard } from '../components/clay/ClayCard';
import { ClayButton } from '../components/clay/ClayButton';
import { ClayBadge } from '../components/clay/ClayBadge';
import { ClayStatCard } from '../components/clay/ClayStatCard';
import { api } from '../services/api';
import type { User, WalletData } from '../types';

interface WalletPageProps {
  currentUser: User;
  onNavigate: (page: string) => void;
  onOpenTopUp: () => void;
}

export const WalletPage: React.FC<WalletPageProps> = ({ currentUser, onNavigate, onOpenTopUp }) => {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [activeTab, setActiveTab] = useState<'purchases' | 'ledger'>('purchases');

  useEffect(() => {
    loadWallet();
  }, [currentUser]);

  const loadWallet = async () => {
    const data = await api.getWallet();
    setWallet(data);
  };

  const totalPurchased = wallet?.total_purchased ?? 0;
  const totalEarned = wallet?.total_earned ?? 6.0;
  const totalSpent = wallet?.total_spent ?? 3.0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>TimeCredit Wallet & Ledger</h1>
            <ClayBadge variant="amber">ACID Accounting</ClayBadge>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Immutable double-entry ledger. 1 TimeCredit = 15 minutes live tutoring (4 TC = 1 hour).
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <ClayButton variant="mint" size="md" onClick={onOpenTopUp} icon={<PlusCircle size={16} />}>
            Top Up TimeCredits
          </ClayButton>
          <ClayButton variant="secondary" onClick={() => onNavigate('browse')} icon={<ArrowUpRight size={15} />}>
            Spend on Tutoring
          </ClayButton>
        </div>
      </div>

      {/* Primary Metrics Row (Balance, Purchased, Earned, Spent) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
        <ClayStatCard
          title="Current Available Balance"
          value={`${Number(currentUser.balance || 0).toFixed(2)} TC`}
          subtitle="DECIMAL(10, 2) Precision"
          icon={<Wallet size={22} color="#f59e0b" />}
          iconBg="#fef3c7"
          badge="Spendable"
          badgeVariant="amber"
        />

        <ClayStatCard
          title="Top-Up Credits Purchased"
          value={`+${Number(totalPurchased || 0).toFixed(2)} TC`}
          subtitle="Via Razorpay payment gateway"
          icon={<CreditCard size={22} color="#6366f1" />}
          iconBg="#ede9fe"
          badge="Razorpay"
          badgeVariant="lavender"
        />

        <ClayStatCard
          title="Credits Earned from Teaching"
          value={`+${Number(totalEarned || 0).toFixed(2)} TC`}
          subtitle="From verified live video classes"
          icon={<ArrowDownLeft size={22} color="#059669" />}
          iconBg="#d1fae5"
          badge="Earned"
          badgeVariant="mint"
        />

        <ClayStatCard
          title="Credits Spent on Learning"
          value={`-${Number(totalSpent || 0).toFixed(2)} TC`}
          subtitle="Exchanged for 1-on-1 tutoring"
          icon={<ArrowUpRight size={22} color="#dc2626" />}
          iconBg="#ffe4e6"
          badge="Spent"
          badgeVariant="rose"
        />
      </div>

      {/* Top-Up Promotion Banner */}
      <ClayCard
        variant="raised"
        style={{
          background: 'linear-gradient(135deg, #ede9fe 0%, #d1fae5 100%)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          padding: '1.25rem 1.75rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669', boxShadow: '2px 2px 6px rgba(16, 185, 129, 0.25)' }}>
            <Coins size={22} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#065f46' }}>
              Need more learning time? Instant TimeCredit Top-Up
            </div>
            <div style={{ fontSize: '0.825rem', color: '#047857' }}>
              Choose from Starter (10 TC / ₹27), Standard (20 TC / ₹52), or Premium (30 TC / ₹75). Fast & secure Razorpay Checkout.
            </div>
          </div>
        </div>

        <ClayButton variant="mint" onClick={onOpenTopUp} icon={<CreditCard size={16} />}>
          Top Up Now
        </ClayButton>
      </ClayCard>

      {/* Tabs Switcher: Purchase History vs Ledger Audit */}
      <div style={{ display: 'flex', background: 'var(--clay-surface)', padding: '0.35rem', borderRadius: '16px', boxShadow: 'var(--clay-shadow-btn)', width: 'fit-content' }}>
        <button
          onClick={() => setActiveTab('purchases')}
          style={{
            border: 'none',
            padding: '0.55rem 1.25rem',
            borderRadius: '12px',
            background: activeTab === 'purchases' ? 'var(--pastel-lavender-bg)' : 'transparent',
            color: activeTab === 'purchases' ? '#4338ca' : '#64748b',
            fontWeight: 700,
            fontSize: '0.875rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            transition: 'all 0.2s ease'
          }}
        >
          <CreditCard size={15} />
          <span>Purchase History ({wallet?.purchases?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('ledger')}
          style={{
            border: 'none',
            padding: '0.55rem 1.25rem',
            borderRadius: '12px',
            background: activeTab === 'ledger' ? 'var(--pastel-lavender-bg)' : 'transparent',
            color: activeTab === 'ledger' ? '#4338ca' : '#64748b',
            fontWeight: 700,
            fontSize: '0.875rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            transition: 'all 0.2s ease'
          }}
        >
          <ShieldCheck size={15} />
          <span>Double-Entry Ledger Audit ({wallet?.transactions?.length || 0})</span>
        </button>
      </div>

      {/* TAB 1: PURCHASE HISTORY */}
      {activeTab === 'purchases' && (
        <ClayCard variant="raised" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Razorpay Top-Up Purchase History</h2>
              <p style={{ color: '#64748b', fontSize: '0.825rem', marginTop: '0.15rem' }}>
                All TimeCredit purchases completed through Razorpay Standard Checkout with HMAC-SHA256 verification.
              </p>
            </div>
            <ClayBadge variant="lavender">INR Verified</ClayBadge>
          </div>

          {(!wallet?.purchases || wallet.purchases.length === 0) ? (
            <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#64748b' }}>
              <CreditCard size={40} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>No top-up purchases yet</div>
              <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                Purchase your first TimeCredit bundle using our secure Razorpay checkout!
              </p>
              <div style={{ marginTop: '1.25rem' }}>
                <ClayButton variant="mint" onClick={onOpenTopUp} icon={<PlusCircle size={15} />}>
                  Buy TimeCredits
                </ClayButton>
              </div>
            </div>
          ) : (
            <div className="clay-table-container">
              <table className="clay-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Package</th>
                    <th>Credits Added</th>
                    <th>Amount Paid</th>
                    <th>Status</th>
                    <th>Razorpay Reference</th>
                    <th>Date & Time</th>
                  </tr>
                </thead>
                <tbody>
                  {wallet.purchases.map((purchase) => {
                    const isPaid = purchase.status === 'PAID';
                    return (
                      <tr key={purchase.id}>
                        <td>
                          <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1e293b' }}>
                            TimeCredit Purchase
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, color: '#4338ca' }}>
                            {purchase.package_name}
                          </span>
                        </td>
                        <td>
                          <strong style={{ color: isPaid ? '#059669' : '#64748b', fontSize: '0.95rem' }}>
                            +{purchase.credits} TC
                          </strong>
                        </td>
                        <td>
                          <strong style={{ fontSize: '0.95rem' }}>
                            ₹{Number(purchase.amount_inr != null ? purchase.amount_inr : (purchase.amount_paise / 100) || 0).toFixed(2)}
                          </strong>
                        </td>
                        <td>
                          <ClayBadge variant={isPaid ? 'mint' : purchase.status === 'PENDING' ? 'amber' : 'rose'}>
                            {purchase.status}
                          </ClayBadge>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                            <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.725rem', background: '#f1f5f9', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                              {purchase.razorpay_payment_id || purchase.razorpay_order_id}
                            </code>
                            {purchase.razorpay_payment_id && (
                              <span style={{ fontSize: '0.675rem', color: '#94a3b8' }}>
                                Ord: {purchase.razorpay_order_id}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                            {purchase.paid_at || purchase.created_at}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </ClayCard>
      )}

      {/* TAB 2: DOUBLE-ENTRY LEDGER AUDIT */}
      {activeTab === 'ledger' && (
        <ClayCard variant="raised" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Credit Ledger Entries (Audit Trail)</h2>
              <p style={{ color: '#64748b', fontSize: '0.825rem', marginTop: '0.15rem' }}>
                Double-entry append-only immutable logs linked to sessions, purchases, and bonuses.
              </p>
            </div>
            <ClayBadge variant="lavender">Immutable Records</ClayBadge>
          </div>

          <div className="clay-table-container">
            <table className="clay-table">
              <thead>
                <tr>
                  <th>Entry ID</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Transaction Category</th>
                  <th>Linked Session / Description</th>
                  <th>Idempotency Key</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {wallet?.transactions.map((tx) => {
                  const isCredit = tx.entry_type === 'CREDIT';
                  return (
                    <tr key={tx.id}>
                      <td>
                        <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700 }}>
                          #TXN-00{tx.id}
                        </code>
                      </td>
                      <td>
                        <ClayBadge variant={isCredit ? 'mint' : 'rose'}>
                          {tx.entry_type}
                        </ClayBadge>
                      </td>
                      <td>
                        <strong style={{ color: isCredit ? '#059669' : '#dc2626', fontSize: '0.95rem' }}>
                          {isCredit ? '+' : '-'}{Number(tx.amount || 0).toFixed(2)} TC
                        </strong>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                          {tx.transaction_type}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.85rem', color: '#334155' }}>
                          {tx.session_title || 'New User Welcome Bonus'}
                        </span>
                      </td>
                      <td>
                        <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', background: '#edf2f7', padding: '0.15rem 0.45rem', borderRadius: '6px' }}>
                          {tx.idempotency_key}
                        </code>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          {tx.created_at}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ClayCard>
      )}
    </div>
  );
};
