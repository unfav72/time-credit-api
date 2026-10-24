import React from 'react';
import {
  LayoutDashboard,
  User,
  BookOpen,
  Search,
  Inbox,
  Video,
  Wallet,
  BarChart3,
  Bell,
  Settings,
  CalendarCheck,
  CreditCard,
  ShieldCheck,
  PlusCircle,
  MessageSquare
} from 'lucide-react';
import { ClayBadge } from './ClayBadge';

interface ClaySidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  isOpen: boolean;
  onClose: () => void;
  role: 'member' | 'admin';
  onOpenTopUp: () => void;
  unreadCount?: number;
  pendingFriendCount?: number;
}

export const ClaySidebar: React.FC<ClaySidebarProps> = ({
  currentPage,
  onNavigate,
  isOpen,
  onClose,
  role,
  onOpenTopUp,
  unreadCount = 0,
  pendingFriendCount = 0
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { id: 'profile', label: 'My Profile', icon: <User size={18} /> },
    { id: 'skills', label: 'Skills Catalog', icon: <BookOpen size={18} /> },
    { id: 'browse', label: 'Browse Services', icon: <Search size={18} /> },
    { id: 'requests', label: 'Service Requests', icon: <Inbox size={18} /> },
    { id: 'sessions', label: 'My Sessions', icon: <CalendarCheck size={18} /> },
    { id: 'classroom', label: 'Live Classroom', icon: <Video size={18} />, highlight: true },
    { id: 'chat', label: 'Peer Chat & Friends', icon: <MessageSquare size={18} />, badge: pendingFriendCount > 0 ? `${pendingFriendCount} NEW` : null, badgeVariant: 'rose' },
    { id: 'wallet', label: 'TimeCredit Wallet', icon: <Wallet size={18} /> },
    { id: 'reports', label: 'DBMS Analytics', icon: <BarChart3 size={18} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={18} />, badge: unreadCount > 0 ? String(unreadCount) : null, badgeVariant: 'lavender' },
    { id: 'settings', label: 'Settings', icon: <Settings size={18} /> },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(4px)',
            zIndex: 90,
          }}
        />
      )}

      <aside
        style={{
          width: '270px',
          background: 'var(--clay-surface)',
          borderRight: '1px solid rgba(226, 232, 240, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: '65px',
          height: 'calc(100vh - 65px)',
          overflowY: 'auto',
          padding: '1.25rem 0.85rem',
          boxShadow: 'var(--clay-shadow-raised)',
          zIndex: 95,
          transition: 'all 0.3s ease',
        }}
      >
        <div style={{ marginBottom: '0.85rem', padding: '0 0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Main Navigation
            </span>
            {role === 'admin' && (
              <span className="clay-badge clay-badge-rose" style={{ fontSize: '0.65rem' }}>
                ADMIN
              </span>
            )}
          </div>
        </div>

        {/* Top Up Fast Action Card */}
        <div
          onClick={onOpenTopUp}
          style={{
            marginBottom: '1rem',
            padding: '0.85rem',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #ede9fe 0%, #d1fae5 100%)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            cursor: 'pointer',
            boxShadow: 'var(--clay-shadow-btn)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem'
          }}
        >
          <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#10b981', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CreditCard size={18} />
          </div>
          <div>
            <div style={{ fontSize: '0.825rem', fontWeight: 800, color: '#065f46' }}>Top Up TimeCredits</div>
            <div style={{ fontSize: '0.7rem', color: '#047857' }}>Instant Razorpay checkout</div>
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1 }}>
          {navItems.map((item) => {
            const isActive = currentPage === item.id;
            let bg = 'transparent';
            let color = 'var(--text-main)';
            let shadow = 'none';

            if (isActive) {
              bg = 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)';
              color = '#ffffff';
              shadow = '6px 6px 14px rgba(99, 102, 241, 0.35)';
            }

            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  if (window.innerWidth < 1024) onClose();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.65rem 0.95rem',
                  borderRadius: '16px',
                  border: 'none',
                  background: bg,
                  color: color,
                  boxShadow: shadow,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontWeight: isActive ? 700 : 600,
                  fontSize: '0.875rem',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  outline: 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ display: 'flex', opacity: isActive ? 1 : 0.85 }}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  {(item as any).badge && !isActive && (
                    <span
                      className={`clay-badge clay-badge-${(item as any).badgeVariant || 'mint'}`}
                      style={{ fontSize: '0.65rem', padding: '0.15rem 0.45rem', fontWeight: 700 }}
                    >
                      {(item as any).badge}
                    </span>
                  )}
                  {item.highlight && !isActive && !(item as any).badge && (
                    <span
                      className="clay-badge clay-badge-mint"
                      style={{ fontSize: '0.65rem', padding: '0.15rem 0.45rem' }}
                    >
                      IN-BUILT
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </nav>

        {/* Footer info card */}
        <div
          style={{
            marginTop: '1.5rem',
            padding: '1rem',
            borderRadius: '18px',
            background: 'var(--pastel-blue-bg)',
            border: '1px solid rgba(186, 230, 253, 0.8)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--pastel-blue-text)', fontWeight: 700, fontSize: '0.8rem' }}>
            <ShieldCheck size={16} />
            <span>TimeCredit Accounting</span>
          </div>
          <p style={{ fontSize: '0.725rem', color: '#0369a1', lineHeight: 1.4 }}>
            Double-entry ledger equations & Razorpay verified top-ups with ACID transaction guarantees.
          </p>
        </div>
      </aside>
    </>
  );
};
