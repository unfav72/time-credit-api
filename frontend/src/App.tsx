import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, 
  UserPlus, 
  Coins, 
  X, 
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { ClayNavbar } from './components/clay/ClayNavbar';
import { ClaySidebar } from './components/clay/ClaySidebar';
import { TopUpModal } from './components/TopUpModal';
import { ErrorBoundary } from './components/ErrorBoundary';

// Pages
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { LiveClassroomPage } from './pages/LiveClassroomPage';
import { WalletPage } from './pages/WalletPage';
import { SkillsPage } from './pages/SkillsPage';
import { BrowseServicesPage } from './pages/BrowseServicesPage';
import { ServiceRequestsPage } from './pages/ServiceRequestsPage';
import { SessionsPage } from './pages/SessionsPage';
import { ReportsPage } from './pages/ReportsPage';
import { ProfilePage } from './pages/ProfilePage';
import { NotificationsPage } from './pages/NotificationsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ChatPage } from './pages/ChatPage';

import { api } from './services/api';
import type { User } from './types';

interface InAppToast {
  id: string;
  title: string;
  message: string;
  type: 'friend' | 'credit' | 'notification';
  targetPage: string;
}

export function App() {
  const [currentPage, setCurrentPage] = useState<string>(() => api.getToken() ? 'dashboard' : 'login');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [topUpModalOpen, setTopUpModalOpen] = useState<boolean>(false);

  // Global Notification & Friend Request Badges + Real-Time Alerts
  const [unreadNotifCount, setUnreadNotifCount] = useState<number>(0);
  const [pendingFriendCount, setPendingFriendCount] = useState<number>(0);
  const [toast, setToast] = useState<InAppToast | null>(null);

  const knownNotifIds = useRef<Set<number>>(new Set());
  const knownFriendReqIds = useRef<Set<number>>(new Set());
  const initialNotifLoaded = useRef<boolean>(false);
  const initialFriendsLoaded = useRef<boolean>(false);

  // Play pleasant notification sound chime using Web Audio API
  const playNotificationChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.36);
    } catch {
      // Audio autoplay policy catch
    }
  };

  // Trigger native OS / Device notification
  const sendDeviceNotification = (title: string, body: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/favicon.ico',
        });
      } catch (e) {
        console.warn('Native device notification warning:', e);
      }
    }
  };

  useEffect(() => {
    // Check initial user from stored session
    api.getCurrentUser().then(user => {
      setCurrentUser(user);
      if (user) {
        setCurrentPage(prev => (prev === 'login' || prev === 'register' || prev === 'landing') ? 'dashboard' : prev);
      } else {
        setCurrentPage('login');
      }
    });
  }, []);

  // Request browser notification permission once user is authenticated
  useEffect(() => {
    if (currentUser && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, [currentUser]);

  // Global Background Polling for In-App Notifications & Incoming Friend Requests
  useEffect(() => {
    if (!currentUser) return;

    let isMounted = true;

    const pollBackgroundUpdates = async () => {
      try {
        // 1. Poll Notifications
        const notifRes = await api.getNotifications().catch(() => null);
        if (notifRes && isMounted) {
          setUnreadNotifCount(notifRes.unread_count || 0);

          if (!initialNotifLoaded.current) {
            (notifRes.notifications || []).forEach(n => knownNotifIds.current.add(n.id));
            initialNotifLoaded.current = true;
          } else {
            const incoming = (notifRes.notifications || []).filter(n => !knownNotifIds.current.has(n.id));
            if (incoming.length > 0) {
              const latest = incoming[0];
              incoming.forEach(n => knownNotifIds.current.add(n.id));

              const isCredit = (latest.title || '').toLowerCase().includes('credit') || (latest.message || '').toLowerCase().includes('credit');
              sendDeviceNotification(latest.title || 'TimeCredit Live', latest.message);
              playNotificationChime();

              setToast({
                id: `notif-${latest.id}`,
                title: latest.title || 'Notification',
                message: latest.message,
                type: isCredit ? 'credit' : 'notification',
                targetPage: isCredit ? 'wallet' : 'notifications'
              });
            }
          }
        }

        // 2. Poll Friend Requests
        const friendsRes = await api.getFriends().catch(() => null);
        if (friendsRes && isMounted) {
          const pending = friendsRes.pending_received || [];
          setPendingFriendCount(pending.length);

          if (!initialFriendsLoaded.current) {
            pending.forEach(req => knownFriendReqIds.current.add(req.request_id));
            initialFriendsLoaded.current = true;
          } else {
            const incomingReqs = pending.filter(req => !knownFriendReqIds.current.has(req.request_id));
            if (incomingReqs.length > 0) {
              const latestReq = incomingReqs[0];
              incomingReqs.forEach(r => knownFriendReqIds.current.add(r.request_id));

              const senderName = latestReq.sender_name || 'A community member';
              const title = 'New Friend Request!';
              const message = `${senderName} sent you a friend request on TimeCredit Live.`;

              sendDeviceNotification(title, message);
              playNotificationChime();

              setToast({
                id: `friend-${latestReq.request_id}`,
                title,
                message,
                type: 'friend',
                targetPage: 'chat'
              });
            }
          }
        }
      } catch {
        // Silently handle background errors
      }
    };

    pollBackgroundUpdates();
    const pollInterval = setInterval(pollBackgroundUpdates, 5500);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [currentUser]);

  // Auto-dismiss floating toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 7000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleNavigate = (page: string) => {
    if (page === 'landing') {
      setCurrentPage(currentUser ? 'dashboard' : 'login');
      return;
    }
    if (page === 'notifications') {
      setUnreadNotifCount(0);
    }
    if (page === 'chat') {
      setToast(prev => (prev?.type === 'friend' ? null : prev));
    }
    setCurrentPage(page);
  };

  const handleOpenAuth = (mode: 'login' | 'register') => {
    setCurrentPage(mode);
  };

  const handleLogout = async () => {
    await api.logout();
    setCurrentUser(null);
    setCurrentPage('login');
    setUnreadNotifCount(0);
    setPendingFriendCount(0);
    knownNotifIds.current.clear();
    knownFriendReqIds.current.clear();
    initialNotifLoaded.current = false;
    initialFriendsLoaded.current = false;
  };

  const handleTopUpSuccess = async () => {
    const updated = await api.getCurrentUser();
    if (updated) setCurrentUser(updated);
  };

  const isAuthRequired = ['dashboard', 'classroom', 'chat', 'wallet', 'browse', 'requests', 'sessions', 'profile', 'notifications', 'settings', 'skills', 'reports'].includes(currentPage);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--clay-bg)' }}>
      {/* Real-Time Floating Claymorphism Toast Alert */}
      {toast && (
        <aside
          role="alert"
          aria-live="polite"
          style={{
            position: 'fixed',
            top: '1.25rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            padding: '0.85rem 1.25rem',
            maxWidth: '560px',
            width: 'calc(100% - 2rem)',
            background: 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(16px)',
            borderRadius: '1.25rem',
            border: '1.5px solid var(--clay-lavender-border, #E0E7FF)',
            boxShadow: '0 20px 40px -10px rgba(79, 70, 229, 0.22), 0 8px 16px -6px rgba(0,0,0,0.06), inset 0 2px 4px rgba(255, 255, 255, 0.9)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: 1, minWidth: 0 }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                background: toast.type === 'credit' 
                  ? '#ECFDF5' 
                  : toast.type === 'friend' 
                  ? '#EEF2FF' 
                  : '#F5F3FF',
                color: toast.type === 'credit' 
                  ? '#059669' 
                  : toast.type === 'friend' 
                  ? '#4F46E5' 
                  : '#7C3AED',
                border: '1px solid rgba(0,0,0,0.05)',
                boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.8)'
              }}
            >
              {toast.type === 'credit' ? (
                <Coins size={22} />
              ) : toast.type === 'friend' ? (
                <UserPlus size={22} />
              ) : (
                <Bell size={22} />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1E1B4B', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                {toast.title}
                <Sparkles size={14} color="#6366F1" />
              </div>
              <div
                style={{
                  fontSize: '0.8rem',
                  color: '#64748B',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  marginTop: '1px'
                }}
              >
                {toast.message}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            <button
              onClick={() => {
                handleNavigate(toast.targetPage);
                setToast(null);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '0.75rem',
                background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
                color: '#fff',
                fontSize: '0.8rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 10px rgba(79, 70, 229, 0.3)'
              }}
            >
              <span>View</span>
              <ChevronRight size={14} />
            </button>
            <button
              onClick={() => setToast(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
                padding: '0.3rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '8px'
              }}
              title="Dismiss"
            >
              <X size={16} />
            </button>
          </div>
        </aside>
      )}

      {/* Top Navbar */}
      <ClayNavbar
        currentUser={currentUser}
        onNavigate={handleNavigate}
        currentPage={currentPage}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onOpenTopUp={() => setTopUpModalOpen(true)}
        onLogout={handleLogout}
        unreadCount={unreadNotifCount}
        pendingFriendCount={pendingFriendCount}
      />

      {/* Main Layout Area */}
      <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
        {/* Sidebar (Rendered except when logged out or on login, register, or toggled) */}
        {currentUser && sidebarOpen && currentPage !== 'login' && currentPage !== 'register' && (
          <ClaySidebar
            currentPage={currentPage}
            onNavigate={handleNavigate}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            role={currentUser.role}
            onOpenTopUp={() => setTopUpModalOpen(true)}
            unreadCount={unreadNotifCount}
            pendingFriendCount={pendingFriendCount}
          />
        )}

        {/* Page Content Container */}
        <main
          style={{
            flex: 1,
            padding: (currentPage === 'login' || currentPage === 'register') ? '0' : '1.5rem 2rem 4rem',
            maxWidth: (currentPage === 'login' || currentPage === 'register') ? '100%' : '1440px',
            width: '100%',
            margin: '0 auto',
            overflowX: 'hidden'
          }}
        >
          <ErrorBoundary onNavigateHome={() => setCurrentPage('dashboard')}>
            {(currentPage === 'login' || currentPage === 'register' || (!currentUser && isAuthRequired)) && (
              <LoginPage
                onNavigate={handleNavigate}
                onLoginSuccess={(user) => {
                  setCurrentUser(user);
                  setCurrentPage(isAuthRequired && currentPage !== 'login' && currentPage !== 'register' ? currentPage : 'dashboard');
                }}
                initialMode={currentPage === 'register' ? 'register' : 'login'}
              />
            )}

            {currentUser && currentPage === 'dashboard' && (
              <DashboardPage
                currentUser={currentUser}
                onNavigate={handleNavigate}
                onOpenTopUp={() => setTopUpModalOpen(true)}
              />
            )}

            {currentUser && currentPage === 'classroom' && (
              <LiveClassroomPage
                currentUser={currentUser}
                onNavigate={handleNavigate}
              />
            )}

            {currentUser && currentPage === 'chat' && (
              <ChatPage
                currentUser={currentUser}
                onNavigate={handleNavigate}
              />
            )}

            {currentUser && currentPage === 'wallet' && (
              <WalletPage
                currentUser={currentUser}
                onNavigate={handleNavigate}
                onOpenTopUp={() => setTopUpModalOpen(true)}
              />
            )}

            {currentUser && currentPage === 'skills' && (
              <SkillsPage onNavigate={handleNavigate} />
            )}

            {currentUser && currentPage === 'browse' && (
              <BrowseServicesPage
                currentUser={currentUser}
                onNavigate={handleNavigate}
              onOpenTopUp={() => setTopUpModalOpen(true)}
            />
          )}

          {currentUser && currentPage === 'requests' && (
            <ServiceRequestsPage
              currentUser={currentUser}
              onNavigate={handleNavigate}
            />
          )}

          {currentUser && currentPage === 'sessions' && (
            <SessionsPage
              currentUser={currentUser}
              onNavigate={handleNavigate}
            />
          )}

          {currentPage === 'reports' && (
            <ReportsPage onNavigate={handleNavigate} />
          )}

          {currentUser && currentPage === 'profile' && (
            <ProfilePage
              currentUser={currentUser}
              onUpdateUser={setCurrentUser}
            />
          )}

          {currentUser && currentPage === 'notifications' && <NotificationsPage />}

          {currentUser && currentPage === 'settings' && <SettingsPage />}
          </ErrorBoundary>
        </main>
      </div>

      {/* Global Top-Up Modal with Razorpay Checkout */}
      {currentUser && (
        <TopUpModal
          isOpen={topUpModalOpen}
          onClose={() => setTopUpModalOpen(false)}
          currentUser={currentUser}
          onSuccess={handleTopUpSuccess}
        />
      )}
    </div>
  );
}

export default App;
