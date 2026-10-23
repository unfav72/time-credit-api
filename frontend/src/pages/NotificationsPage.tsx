import React, { useState } from 'react';
import {
  Bell,
  Coins,
  Video,
  CheckCircle2,
  CalendarCheck,
  Sparkles
} from 'lucide-react';
import { ClayCard } from '../components/clay/ClayCard';
import { ClayButton } from '../components/clay/ClayButton';
import { ClayBadge } from '../components/clay/ClayBadge';

export const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      title: 'TimeCredits Transferred!',
      message: 'You earned 1.00 TimeCredit for completing your live SQL Query Lab coaching session with Marcus Vance.',
      time: '10 minutes ago',
      read: false,
      icon: <Coins size={18} color="#f59e0b" />,
      type: 'credit'
    },
    {
      id: 2,
      title: 'New Service Request Accepted',
      message: 'Priya Patel accepted your booking for "Mastering Advanced SQL Joins & Subqueries". Live classroom room assigned: timecredit-session-priya-marcus-9021.',
      time: '2 hours ago',
      read: true,
      icon: <Video size={18} color="#6366f1" />,
      type: 'session'
    },
    {
      id: 3,
      title: 'Welcome to TimeCredit Live!',
      message: 'Welcome! 2.00 signup bonus TimeCredits have been credited to your wallet via MySQL trigger trg_after_user_insert.',
      time: '1 day ago',
      read: true,
      icon: <Sparkles size={18} color="#10b981" />,
      type: 'system'
    }
  ]);

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '820px', margin: '0 auto' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Notifications</h1>
            <ClayBadge variant="lavender">
              {notifications.filter(n => !n.read).length} Unread
            </ClayBadge>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Session updates, ledger transfers, and system announcements.
          </p>
        </div>

        <ClayButton variant="secondary" onClick={markAllRead}>
          Mark All as Read
        </ClayButton>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {notifications.map(n => (
          <ClayCard
            key={n.id}
            variant="raised"
            style={{
              padding: '1.15rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '1rem',
              background: n.read ? '#f8fafc' : '#ffffff',
              border: n.read ? '1px solid #e2e8f0' : '2px solid rgba(99, 102, 241, 0.4)'
            }}
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: 'inset 1px 1px 2px rgba(255,255,255,0.8)' }}>
              {n.icon}
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {n.title}
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{n.time}</span>
              </div>
              <p style={{ color: '#475569', fontSize: '0.85rem', lineHeight: 1.5, marginTop: '0.25rem' }}>
                {n.message}
              </p>
            </div>
          </ClayCard>
        ))}
      </div>
    </div>
  );
};
