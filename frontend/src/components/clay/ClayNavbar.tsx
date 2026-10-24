import React, { useState, useEffect } from 'react';
import { 
  Coins, 
  Menu, 
  Wifi, 
  WifiOff, 
  Download, 
  UserCheck, 
  LogOut, 
  Sparkles,
  Home,
  CreditCard,
  PlusCircle,
  Video,
  LogIn,
  MessageSquare,
  Bell
} from 'lucide-react';
import { ClayBadge } from './ClayBadge';
import { ClayButton } from './ClayButton';
import type { User } from '../../types';

interface ClayNavbarProps {
  currentUser: User | null;
  onNavigate: (page: string) => void;
  currentPage: string;
  onToggleSidebar: () => void;
  onOpenTopUp: () => void;
  onLogout: () => void;
  unreadCount?: number;
  pendingFriendCount?: number;
}

export const ClayNavbar: React.FC<ClayNavbarProps> = ({
  currentUser,
  onNavigate,
  currentPage,
  onToggleSidebar,
  onOpenTopUp,
  onLogout,
  unreadCount = 0,
  pendingFriendCount = 0
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      alert('To install TimeCredit Live on your device:\n\n• On Chrome/Edge: Click the install icon in the URL address bar or select "Install TimeCredit Live" from the browser menu.\n• On iOS Safari: Tap Share -> "Add to Home Screen".');
    }
  };

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'rgba(240, 244, 249, 0.9)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(226, 232, 240, 0.8)',
        padding: '0.75rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
      }}
    >
      {/* Brand & Hamburger */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        <button
          onClick={onToggleSidebar}
          style={{
            background: 'var(--clay-surface)',
            border: 'none',
            borderRadius: '12px',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: 'var(--clay-shadow-btn)',
            color: 'var(--text-main)',
          }}
          title="Toggle Navigation Menu"
        >
          <Menu size={20} />
        </button>

        <div
          onClick={() => onNavigate(currentUser ? 'dashboard' : 'login')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer' }}
        >
          <img
            src="/logo.png"
            alt="TimeCredit Live Logo"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              boxShadow: '3px 3px 8px rgba(166, 180, 200, 0.4)',
              objectFit: 'cover'
            }}
          />
          <div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              TimeCredit <span style={{ color: '#6366f1' }}>Live</span>
              <ClayBadge variant="lavender" style={{ fontSize: '0.65rem', padding: '0.15rem 0.5rem' }}>PWA</ClayBadge>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              Skill Exchange & Live Learning
            </div>
          </div>
        </div>
      </div>

      {/* Middle Shortcuts */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <ClayButton
          size="sm"
          variant={currentPage === 'dashboard' ? 'primary' : 'secondary'}
          onClick={() => onNavigate('dashboard')}
        >
          Dashboard
        </ClayButton>

        <ClayButton
          size="sm"
          variant={currentPage === 'classroom' ? 'primary' : 'secondary'}
          onClick={() => onNavigate('classroom')}
          icon={<Video size={15} />}
        >
          Classroom
        </ClayButton>

        {currentUser && (
          <div style={{ position: 'relative', display: 'inline-flex' }}>
            <ClayButton
              size="sm"
              variant={currentPage === 'chat' ? 'primary' : 'secondary'}
              onClick={() => onNavigate('chat')}
              icon={<MessageSquare size={15} />}
            >
              Chat & Friends
            </ClayButton>
            {pendingFriendCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-5px',
                  right: '-6px',
                  background: '#ef4444',
                  color: '#ffffff',
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  borderRadius: '10px',
                  padding: '1px 6px',
                  boxShadow: '0 2px 6px rgba(239, 68, 68, 0.45)',
                  border: '2px solid #ffffff',
                  lineHeight: 1.2
                }}
                title={`${pendingFriendCount} pending friend request${pendingFriendCount > 1 ? 's' : ''}`}
              >
                {pendingFriendCount}
              </span>
            )}
          </div>
        )}

        {/* Top Up TimeCredits Button */}
        <ClayButton
          size="sm"
          variant="mint"
          onClick={onOpenTopUp}
          icon={<PlusCircle size={15} />}
        >
          Top Up Credits
        </ClayButton>

        {/* Sign In Button (only shown if not logged in) */}
        {!currentUser && (
          <ClayButton
            size="sm"
            variant={currentPage === 'login' ? 'primary' : 'secondary'}
            onClick={() => onNavigate('login')}
            icon={<LogIn size={14} />}
          >
            Sign In
          </ClayButton>
        )}

        {/* PWA Install Button */}
        <ClayButton
          size="sm"
          variant="secondary"
          onClick={handleInstallClick}
          icon={<Download size={14} />}
          title="Install as Progressive Web App"
        >
          Install
        </ClayButton>
      </div>

      {/* Right User & Status Area */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        {/* Online / Offline indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.4rem 0.8rem',
            borderRadius: '9999px',
            background: isOnline ? 'var(--pastel-mint-bg)' : 'var(--pastel-rose-bg)',
            color: isOnline ? 'var(--pastel-mint-text)' : 'var(--pastel-rose-text)',
            fontSize: '0.75rem',
            fontWeight: 700,
            boxShadow: 'inset 1px 1px 2px rgba(255, 255, 255, 0.7)',
          }}
          title={isOnline ? 'Online: Real-time sync active' : 'Offline: Operating with cached app shell'}
        >
          {isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
          <span>{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
        </div>

        {currentUser ? (
          <>
            {/* Notification Bell with Unread Badge */}
            <button
              onClick={() => onNavigate('notifications')}
              style={{
                position: 'relative',
                background: 'var(--clay-surface)',
                border: 'none',
                borderRadius: '14px',
                width: '38px',
                height: '38px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: 'var(--clay-shadow-btn)',
                color: currentPage === 'notifications' ? '#6366f1' : '#475569',
              }}
              title={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : "Notifications"}
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-3px',
                    right: '-3px',
                    background: '#ef4444',
                    color: '#ffffff',
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    borderRadius: '10px',
                    padding: '1px 5px',
                    minWidth: '16px',
                    textAlign: 'center',
                    boxShadow: '0 2px 5px rgba(239, 68, 68, 0.5)',
                    border: '2px solid #ffffff',
                    lineHeight: 1.2
                  }}
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Credit Balance Pill */}
            <div
              onClick={() => onNavigate('wallet')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                background: 'var(--clay-surface)',
                padding: '0.4rem 0.85rem',
                borderRadius: '16px',
                boxShadow: 'var(--clay-shadow-btn)',
                cursor: 'pointer',
                border: '1px solid rgba(255, 255, 255, 0.7)'
              }}
              title="View TimeCredit Wallet & Double-Entry Ledger"
            >
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  boxShadow: 'inset 1px 1px 2px rgba(255, 255, 255, 0.8)'
                }}
              >
                <Coins size={13} />
              </div>
              <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>
                {Number(currentUser.balance || 0).toFixed(2)}
              </span>
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b' }}>
                TC
              </span>
            </div>

            {/* User Profile Dropdown */}
            <div style={{ position: 'relative' }}>
              <div
                onClick={() => setShowUserMenu(!showUserMenu)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: 'var(--clay-surface)',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '16px',
                  boxShadow: 'var(--clay-shadow-btn)',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.85rem'
                  }}
                >
                  {currentUser.full_name ? currentUser.full_name.charAt(0) : 'U'}
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.2 }}>
                    {currentUser.full_name.split(' ')[0]}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    {currentUser.role}
                  </div>
                </div>
              </div>

              {/* User Menu Modal / Dropdown */}
              {showUserMenu && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '115%',
                    width: '260px',
                    background: '#ffffff',
                    borderRadius: '20px',
                    padding: '1rem',
                    boxShadow: 'var(--clay-shadow-float)',
                    border: '1px solid rgba(226, 232, 240, 0.9)',
                    zIndex: 200,
                  }}
                >
                  <div style={{ paddingBottom: '0.75rem', borderBottom: '1px solid #e2e8f0', marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      {currentUser.full_name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {currentUser.email}
                    </div>
                    <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.4rem' }}>
                      <ClayBadge variant={currentUser.role === 'admin' ? 'rose' : 'sky'}>
                        {currentUser.role.toUpperCase()}
                      </ClayBadge>
                      <ClayBadge variant="amber">
                        {Number(currentUser.balance || 0).toFixed(2)} TC
                      </ClayBadge>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <button
                      onClick={() => {
                        onOpenTopUp();
                        setShowUserMenu(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.75rem',
                        background: 'var(--pastel-mint-bg)',
                        border: 'none',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        color: '#065f46',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      <CreditCard size={15} /> Top Up TimeCredits
                    </button>

                    <button
                      onClick={() => {
                        onNavigate('wallet');
                        setShowUserMenu(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: 'var(--text-main)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      <Coins size={15} /> Wallet & Purchases
                    </button>

                    <button
                      onClick={() => {
                        onNavigate('profile');
                        setShowUserMenu(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: 'var(--text-main)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      <UserCheck size={15} /> Profile & Bio
                    </button>

                    <button
                      onClick={() => {
                        onNavigate('login');
                        setShowUserMenu(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: 'var(--text-main)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      <LogIn size={15} /> Switch / Sign In
                    </button>

                    <button
                      onClick={() => {
                        onLogout();
                        setShowUserMenu(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        background: '#fee2e2',
                        border: 'none',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        color: '#dc2626',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginTop: '0.25rem'
                      }}
                    >
                      <LogOut size={15} /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ClayButton
              size="sm"
              variant={currentPage === 'login' ? 'primary' : 'secondary'}
              onClick={() => onNavigate('login')}
              icon={<LogIn size={14} />}
            >
              Sign In
            </ClayButton>
            <ClayButton
              size="sm"
              variant="mint"
              onClick={() => onNavigate('register')}
              icon={<Sparkles size={14} />}
            >
              Get Started
            </ClayButton>
          </div>
        )}
      </div>
    </header>
  );
};
