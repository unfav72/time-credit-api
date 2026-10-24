import React, { useState, useEffect } from 'react';
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

import { api } from './services/api';
import type { User } from './types';

export function App() {
  const [currentPage, setCurrentPage] = useState<string>(() => api.getToken() ? 'dashboard' : 'login');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [topUpModalOpen, setTopUpModalOpen] = useState<boolean>(false);

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

  const handleNavigate = (page: string) => {
    if (page === 'landing') {
      setCurrentPage(currentUser ? 'dashboard' : 'login');
      return;
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
  };

  const handleTopUpSuccess = async () => {
    const updated = await api.getCurrentUser();
    if (updated) setCurrentUser(updated);
  };

  const isAuthRequired = ['dashboard', 'classroom', 'wallet', 'browse', 'requests', 'sessions', 'profile', 'notifications', 'settings', 'skills', 'reports'].includes(currentPage);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--clay-bg)' }}>
      {/* Top Navbar */}
      <ClayNavbar
        currentUser={currentUser}
        onNavigate={handleNavigate}
        currentPage={currentPage}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onOpenTopUp={() => setTopUpModalOpen(true)}
        onLogout={handleLogout}
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
