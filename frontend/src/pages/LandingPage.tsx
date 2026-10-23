import React from 'react';
import { 
  Sparkles, 
  Clock, 
  Coins, 
  Video, 
  CreditCard, 
  ArrowRight, 
  ShieldCheck, 
  BookOpen, 
  CheckCircle2, 
  Users,
  Layers,
  Star
} from 'lucide-react';
import { ClayCard } from '../components/clay/ClayCard';
import { ClayButton } from '../components/clay/ClayButton';
import { ClayBadge } from '../components/clay/ClayBadge';
import { TOPUP_PACKAGES } from '../services/api';

interface LandingPageProps {
  onNavigate: (page: string) => void;
  onOpenTopUp: () => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ 
  onNavigate, 
  onOpenTopUp,
  onOpenAuth 
}) => {
  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '1.5rem 1rem 4rem' }}>
      {/* Hero Section */}
      <section style={{ textAlign: 'center', padding: '2.5rem 1rem 3.5rem', position: 'relative' }}>
        <div style={{ display: 'inline-flex', marginBottom: '1.25rem' }}>
          <ClayBadge variant="lavender" icon={<Sparkles size={14} />}>
            Skill Exchange & Live Learning Platform
          </ClayBadge>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <img
            src="/logo.png"
            alt="TimeCredit Live 3D Clay Logo"
            style={{
              width: '130px',
              height: '130px',
              borderRadius: '32px',
              boxShadow: 'var(--clay-shadow-float)',
              border: '4px solid #ffffff',
            }}
          />
        </div>

        <h1 style={{ fontSize: 'clamp(2.2rem, 5vw, 3.8rem)', fontWeight: 800, lineHeight: 1.15, color: '#0f172a', letterSpacing: '-0.03em' }}>
          Share Skills. Earn Time.<br />
          <span style={{ background: 'var(--primary-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Grow Together.
          </span>
        </h1>

        <p style={{ maxWidth: '680px', margin: '1.25rem auto 2.25rem', fontSize: '1.15rem', color: '#475569', lineHeight: 1.6 }}>
          TimeCredit Live is a peer-to-peer live learning and skill-exchange platform. Exchange your knowledge using time credits rather than money: <strong>one hour taught equals one TimeCredit earned</strong>, or instantly top up credits via secure Razorpay checkout.
        </p>

        {/* Call to Actions */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1rem' }}>
          <ClayButton size="lg" variant="primary" onClick={() => onNavigate('dashboard')} icon={<ArrowRight size={18} />}>
            Enter Dashboard
          </ClayButton>
          <ClayButton size="lg" variant="mint" onClick={onOpenTopUp} icon={<CreditCard size={18} />}>
            Top Up TimeCredits (Razorpay)
          </ClayButton>
          <ClayButton size="lg" variant="secondary" onClick={() => onNavigate('login')}>
            Sign In / Register
          </ClayButton>
        </div>
      </section>

      {/* How TimeCredit Works Grid */}
      <section style={{ margin: '3rem 0' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <ClayBadge variant="sky">Platform Mechanics</ClayBadge>
          <h2 style={{ fontSize: '2rem', marginTop: '0.5rem' }}>How TimeCredit Live Works</h2>
          <p style={{ color: '#64748b', maxWidth: '520px', margin: '0.5rem auto' }}>
            A fair, inclusive knowledge currency powered by relational database transactions and instant top-ups.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
          <ClayCard variant="raised">
            <div style={{ width: '50px', height: '50px', borderRadius: '18px', background: 'var(--pastel-blue-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7', marginBottom: '1rem', boxShadow: 'inset 2px 2px 4px rgba(255,255,255,0.8)' }}>
              <BookOpen size={24} />
            </div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>1. List Your Skills</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.5 }}>
              Share what you know—from DBMS Normalization and React to AI pipelines and graphic design.
            </p>
          </ClayCard>

          <ClayCard variant="raised">
            <div style={{ width: '50px', height: '50px', borderRadius: '18px', background: 'var(--pastel-lavender-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1', marginBottom: '1rem', boxShadow: 'inset 2px 2px 4px rgba(255,255,255,0.8)' }}>
              <Video size={24} />
            </div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>2. In-Built Video Classroom</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.5 }}>
              Conduct interactive 1-on-1 lessons directly in the browser with real camera, mic, screen sharing, and live whiteboard notes.
            </p>
          </ClayCard>

          <ClayCard variant="raised">
            <div style={{ width: '50px', height: '50px', borderRadius: '18px', background: 'var(--pastel-mint-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669', marginBottom: '1rem', boxShadow: 'inset 2px 2px 4px rgba(255,255,255,0.8)' }}>
              <Coins size={24} />
            </div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>3. Earn TimeCredits</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.5 }}>
              1 hour of teaching automatically settles 1.00 credit into your account via double-entry SQL ledger transactions.
            </p>
          </ClayCard>

          <ClayCard variant="raised">
            <div style={{ width: '50px', height: '50px', borderRadius: '18px', background: 'var(--pastel-amber-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706', marginBottom: '1rem', boxShadow: 'inset 2px 2px 4px rgba(255,255,255,0.8)' }}>
              <CreditCard size={24} />
            </div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>4. Instant Razorpay Top-Up</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.5 }}>
              Need credits right away? Choose from 3 fixed packages starting at just ₹27 for 150 minutes of verified learning time.
            </p>
          </ClayCard>
        </div>
      </section>

      {/* Feature Showcase: Razorpay Top-Up Packages */}
      <section style={{ margin: '4rem 0' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <ClayBadge variant="mint" icon={<CreditCard size={14} />}>
            Top Up System
          </ClayBadge>
          <h2 style={{ fontSize: '2rem', marginTop: '0.5rem' }}>Fixed TimeCredit Packages</h2>
          <p style={{ color: '#64748b', maxWidth: '580px', margin: '0.5rem auto' }}>
            Instant credit deposits with Razorpay Standard Checkout. 1 TimeCredit = 15 minutes of live learning.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', alignItems: 'stretch' }}>
          {TOPUP_PACKAGES.map((pkg) => (
            <ClayCard
              key={pkg.id}
              variant="raised"
              style={{
                borderRadius: '24px',
                padding: '2rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                background: pkg.popular
                  ? 'linear-gradient(135deg, #ede9fe 0%, #e0f2fe 100%)'
                  : '#f8fafc',
                border: pkg.popular ? '2px solid #6366f1' : '1px solid #e2e8f0',
                boxShadow: pkg.popular ? 'var(--clay-shadow-float)' : 'var(--clay-shadow-raised)',
                position: 'relative'
              }}
            >
              {pkg.popular && (
                <div style={{ position: 'absolute', top: '-12px', right: '20px' }}>
                  <ClayBadge variant="lavender" icon={<Star size={12} fill="#6366f1" />}>
                    MOST POPULAR
                  </ClayBadge>
                </div>
              )}

              <div>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  {pkg.name} Package
                </h3>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.2rem' }}>
                  {pkg.learning_minutes} minutes ({pkg.learning_minutes / 60} hours) learning time
                </div>

                <div style={{ margin: '1.5rem 0' }}>
                  <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#0f172a' }}>
                    {pkg.credits} <span style={{ fontSize: '1.1rem', color: '#6366f1' }}>Credits</span>
                  </div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#059669', marginTop: '0.25rem' }}>
                    ₹{pkg.price_inr}.00
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem', color: '#475569', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CheckCircle2 size={16} color="#10b981" />
                    <span>Instant wallet deposit</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CheckCircle2 size={16} color="#10b981" />
                    <span>Razorpay Secure payment</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CheckCircle2 size={16} color="#10b981" />
                    <span>Auditable transaction reference</span>
                  </div>
                </div>
              </div>

              <ClayButton
                variant={pkg.popular ? 'mint' : 'primary'}
                onClick={onOpenTopUp}
                style={{ width: '100%' }}
              >
                Top Up {pkg.name} (₹{pkg.price_inr})
              </ClayButton>
            </ClayCard>
          ))}
        </div>
      </section>

      {/* PWA & Installation Banner */}
      <section style={{ margin: '3rem 0', textAlign: 'center' }}>
        <ClayCard variant="inset" style={{ padding: '2.5rem' }}>
          <ClayBadge variant="mint">Production PWA</ClayBadge>
          <h2 style={{ fontSize: '1.8rem', marginTop: '0.5rem' }}>Installable on Any Device</h2>
          <p style={{ color: '#64748b', maxWidth: '580px', margin: '0.5rem auto 1.5rem', fontSize: '0.95rem' }}>
            TimeCredit Live conforms to PWA standards with an offline service worker, responsive touch controls, and standalone home screen launching.
          </p>
          <ClayButton variant="primary" onClick={() => onNavigate('dashboard')}>
            Launch Dashboard
          </ClayButton>
        </ClayCard>
      </section>
    </div>
  );
};
