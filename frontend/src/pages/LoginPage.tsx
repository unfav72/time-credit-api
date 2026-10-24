import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Coins,
  Video,
  CheckCircle2,
  Clock,
  ArrowLeft
} from 'lucide-react';
import { ClayCard } from '../components/clay/ClayCard';
import { ClayButton } from '../components/clay/ClayButton';
import { ClayBadge } from '../components/clay/ClayBadge';
import { ClayInput } from '../components/clay/ClayInput';
import { api } from '../services/api';
import type { User as UserType } from '../types';

interface LoginPageProps {
  onNavigate: (page: string) => void;
  onLoginSuccess: (user: UserType) => void;
  initialMode?: 'login' | 'register';
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onNavigate,
  onLoginSuccess,
  initialMode = 'login'
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (mode === 'login') {
      if (!email.trim()) {
        setError('Please enter your email address.');
        return;
      }
      if (!password) {
        setError('Please enter your password.');
        return;
      }

      setLoading(true);
      try {
        const user = await api.login(email.trim(), password);
        setSuccessMsg(`Welcome back, ${user.full_name}! Redirecting...`);
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 }
        });
        setTimeout(() => {
          onLoginSuccess(user);
          onNavigate('dashboard');
        }, 600);
      } catch (err: any) {
        setError(err?.message || 'Login failed. Please check your credentials.');
        setLoading(false);
      }
    } else {
      if (!fullName.trim()) {
        setError('Please enter your full name.');
        return;
      }
      if (!email.trim() || !email.includes('@')) {
        setError('Please enter a valid email address.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }

      setLoading(true);
      try {
        const user = await api.register(fullName.trim(), email.trim(), password, confirmPassword);
        setSuccessMsg('Account created successfully! +2.00 Welcome Credits added.');
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.6 }
        });
        setTimeout(() => {
          onLoginSuccess(user);
          onNavigate('dashboard');
        }, 700);
      } catch (err: any) {
        setError(err?.message || 'Registration failed. Please try again.');
        setLoading(false);
      }
    }
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '1rem auto 4rem', padding: '0 1rem' }}>
      {/* Top back navigation */}
      <div style={{ marginBottom: '1.25rem' }}>
        <button
          onClick={() => onNavigate('landing')}
          style={{
            background: 'none',
            border: 'none',
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 700,
            padding: '0.4rem 0.6rem',
            borderRadius: '10px'
          }}
        >
          <ArrowLeft size={16} /> Back to Landing Page
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '2rem',
          alignItems: 'stretch'
        }}
      >
        {/* Left Side: Brand Value Proposition & Trust Showcase */}
        <ClayCard
          variant="raised"
          style={{
            background: 'linear-gradient(135deg, #ede9fe 0%, #e0f2fe 100%)',
            border: '2px solid rgba(255, 255, 255, 0.9)',
            padding: '2.5rem 2rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '2rem'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.5rem' }}>
              <img
                src="/logo.png"
                alt="TimeCredit Live Logo"
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '16px',
                  boxShadow: 'var(--clay-shadow-float)',
                  objectFit: 'cover'
                }}
              />
              <div>
                <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  TimeCredit <span style={{ color: '#6366f1' }}>Live</span>
                  <ClayBadge variant="lavender" style={{ fontSize: '0.65rem' }}>PWA</ClayBadge>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                  Live Peer Skill Exchange & Time Banking
                </div>
              </div>
            </div>

            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.25, letterSpacing: '-0.02em' }}>
              Learn anything.<br />
              <span style={{ color: '#6366f1' }}>Teach what you love.</span>
            </h2>

            <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: 1.6, marginTop: '0.75rem' }}>
              Join a vibrant community of passionate learners and tutors. Exchange knowledge fairly using time credits instead of money.
            </p>

            {/* Feature Highlights Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(255, 255, 255, 0.65)', padding: '0.75rem 1rem', borderRadius: '16px', backdropFilter: 'blur(4px)' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: '#dcfce7', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Coins size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#14532d' }}>1 TimeCredit = 15 Minutes</div>
                  <div style={{ fontSize: '0.725rem', color: '#166534' }}>Transparent, fixed learning time standard.</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(255, 255, 255, 0.65)', padding: '0.75rem 1rem', borderRadius: '16px', backdropFilter: 'blur(4px)' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: '#ede9fe', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Video size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#312e81' }}>In-Built Live Video Meeting</div>
                  <div style={{ fontSize: '0.725rem', color: '#4338ca' }}>WebRTC video, mic, screenshare & whiteboard.</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(255, 255, 255, 0.65)', padding: '0.75rem 1rem', borderRadius: '16px', backdropFilter: 'blur(4px)' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0c4a6e' }}>ACID Double-Entry Ledger</div>
                  <div style={{ fontSize: '0.725rem', color: '#0369a1' }}>Guaranteed tamper-proof balance records in PostgreSQL.</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(148, 163, 184, 0.3)', paddingTop: '1.25rem', fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>
            "The greatest gift you can share with another is your knowledge and your time."
          </div>
        </ClayCard>

        {/* Right Side: Interactive Auth Box */}
        <ClayCard variant="raised" style={{ padding: '2.5rem 2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {/* Segmented Mode Switcher */}
          <div
            style={{
              display: 'flex',
              background: '#e2e8f0',
              padding: '0.3rem',
              borderRadius: '16px',
              marginBottom: '1.75rem'
            }}
          >
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
                setSuccessMsg('');
              }}
              style={{
                flex: 1,
                border: 'none',
                padding: '0.6rem 1rem',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                background: mode === 'login' ? '#ffffff' : 'transparent',
                color: mode === 'login' ? '#0f172a' : '#64748b',
                boxShadow: mode === 'login' ? 'var(--clay-shadow-btn)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
                setSuccessMsg('');
              }}
              style={{
                flex: 1,
                border: 'none',
                padding: '0.6rem 1rem',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                background: mode === 'register' ? '#ffffff' : 'transparent',
                color: mode === 'register' ? '#0f172a' : '#64748b',
                boxShadow: mode === 'register' ? 'var(--clay-shadow-btn)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              Create Account
            </button>
          </div>

          {/* Heading */}
          <div style={{ marginBottom: '1.25rem' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              {mode === 'login' ? 'Welcome Back!' : 'Start Exchanging Skills'}
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.2rem' }}>
              {mode === 'login'
                ? 'Sign in to access your dashboard, sessions, and TimeCredit wallet.'
                : 'Create an account to immediately claim 2.00 free welcome credits!'}
            </p>
          </div>

          {/* Bonus callout banner for registration */}
          {mode === 'register' && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #dcfce7 0%, #fef3c7 100%)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.825rem',
                color: '#065f46',
                fontWeight: 700
              }}
            >
              <Sparkles size={16} color="#059669" />
              <span>🎁 Sign up bonus: +2.00 Free TimeCredits credited instantly!</span>
            </div>
          )}

          {/* Error Message Alert */}
          {error && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '14px',
                background: 'var(--pastel-rose-bg)',
                color: 'var(--pastel-rose-text)',
                fontSize: '0.85rem',
                fontWeight: 600,
                marginBottom: '1.25rem',
                border: '1px solid rgba(244, 63, 94, 0.3)'
              }}
            >
              {error}
            </div>
          )}

          {/* Success Message Alert */}
          {successMsg && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '14px',
                background: 'var(--pastel-mint-bg)',
                color: 'var(--pastel-mint-text)',
                fontSize: '0.85rem',
                fontWeight: 700,
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            {mode === 'register' && (
              <ClayInput
                label="Full Name"
                placeholder="e.g. Maya Lin"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                icon={<User size={16} />}
                required
              />
            )}

            <ClayInput
              label="Email Address"
              type="email"
              placeholder="you@college.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail size={16} />}
              required
            />

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                  Password
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => alert('Password reset instructions: Please contact your academic administrator or re-register with your university email.')}
                    style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: '0.775rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Forgot Password?
                  </button>
                )}
              </div>

              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span style={{ position: 'absolute', left: '1rem', color: '#94a3b8', pointerEvents: 'none', display: 'flex' }}>
                  <Lock size={16} />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="clay-input"
                  style={{ paddingLeft: '2.8rem', paddingRight: '2.8rem', width: '100%' }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '1rem',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 0
                  }}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <ClayInput
                label="Confirm Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                icon={<Lock size={16} />}
                required
              />
            )}

            {mode === 'login' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem', color: '#475569', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    style={{ accentColor: '#6366f1', cursor: 'pointer' }}
                  />
                  <span>Remember me for 30 days</span>
                </label>
              </div>
            )}

            <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <ClayButton
                variant="primary"
                size="lg"
                type="submit"
                disabled={loading}
                icon={<ArrowRight size={18} />}
              >
                {loading
                  ? (mode === 'login' ? 'Signing In...' : 'Creating Account...')
                  : (mode === 'login' ? 'Sign In to TimeCredit' : 'Create Account & Claim 2.0 TC')}
              </ClayButton>

              <div style={{ textAlign: 'center', marginTop: '0.25rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === 'login' ? 'register' : 'login');
                    setError('');
                    setSuccessMsg('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#6366f1',
                    fontSize: '0.825rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: '0.35rem'
                  }}
                >
                  {mode === 'login'
                    ? "Don't have an account yet? Register here"
                    : 'Already have an account? Sign in here'}
                </button>
              </div>
            </div>
          </form>
        </ClayCard>
      </div>
    </div>
  );
};
