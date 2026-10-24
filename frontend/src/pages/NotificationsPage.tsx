import React, { useState, useEffect } from 'react';
import {
  Bell,
  Coins,
  Video,
  CheckCircle2,
  CalendarCheck,
  Sparkles,
  Shield,
  Loader2,
  Send,
  Volume2
} from 'lucide-react';
import { ClayCard } from '../components/clay/ClayCard';
import { ClayButton } from '../components/clay/ClayButton';
import { ClayBadge } from '../components/clay/ClayBadge';
import { api } from '../services/api';
import type { AppNotification } from '../types';

export const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    loadNotifications();
    checkPushStatus();
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.getNotifications();
      setNotifications(res.notifications || []);
    } catch (err: any) {
      console.warn('Failed loading notifications from database:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkPushStatus = async () => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setPushEnabled(!!sub);
      } catch {
        setPushEnabled(false);
      }
    }
  };

  const handleTogglePush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Browser Push Notifications are not supported on this browser or platform.');
      return;
    }

    try {
      setPushLoading(true);
      const reg = await navigator.serviceWorker.ready;

      if (pushEnabled) {
        // Unsubscribe
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          await api.unsubscribePush(sub.endpoint);
        }
        setPushEnabled(false);
        setFeedback('Browser Web Push notifications disabled.');
      } else {
        // Request browser permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          alert('Notification permission was denied in your browser settings.');
          setPushLoading(false);
          return;
        }

        // Get VAPID public key from backend
        let vapidKey = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
        try {
          vapidKey = await api.getVapidPublicKey();
        } catch {
          // Use default key
        }

        // Convert base64 VAPID to Uint8Array
        const padding = '='.repeat((4 - (vapidKey.length % 4)) % 4);
        const base64 = (vapidKey + padding).replace(/\-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i);
        }

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: outputArray
        });

        await api.subscribePush(sub.toJSON());
        setPushEnabled(true);
        setFeedback('Browser Web Push notifications successfully enabled!');
      }
    } catch (err: any) {
      alert('Web Push subscription error: ' + (err?.message || err));
    } finally {
      setPushLoading(false);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const markAllRead = async () => {
    try {
      await api.markAllNotificationsAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })));
    } catch (err: any) {
      alert('Failed marking notifications read: ' + err?.message);
    }
  };

  const markSingleRead = async (id: number) => {
    try {
      await api.markNotificationAsRead(id);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      );
    } catch (err: any) {
      console.warn('Failed marking notification read:', err);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'SESSION_COMPLETED':
      case 'PAYMENT_SUCCESS':
        return <Coins size={18} color="#f59e0b" />;
      case 'REQUEST_ACCEPTED':
      case 'SESSION_SCHEDULED':
        return <Video size={18} color="#6366f1" />;
      case 'SECURITY':
        return <Shield size={18} color="#ef4444" />;
      default:
        return <Sparkles size={18} color="#10b981" />;
    }
  };

  const unreadCount = notifications.filter(n => !n.read_at).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '820px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Notification Center</h1>
            <ClayBadge variant={unreadCount > 0 ? 'rose' : 'mint'}>
              {unreadCount} Unread
            </ClayBadge>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Live database-driven session updates, ledger transfers, and system alerts.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <ClayButton
            variant={pushEnabled ? 'secondary' : 'mint'}
            onClick={handleTogglePush}
            disabled={pushLoading}
            icon={pushLoading ? <Loader2 size={16} className="animate-spin" /> : <Volume2 size={16} />}
          >
            {pushEnabled ? 'Disable Browser Push' : 'Enable Web Push'}
          </ClayButton>

          {unreadCount > 0 && (
            <ClayButton variant="secondary" onClick={markAllRead}>
              Mark All Read
            </ClayButton>
          )}
        </div>
      </div>

      {feedback && (
        <div style={{ padding: '0.75rem 1rem', borderRadius: '12px', background: 'var(--pastel-mint-bg)', color: 'var(--pastel-mint-text)', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle2 size={16} /> {feedback}
        </div>
      )}

      {loading ? (
        <ClayCard variant="raised" style={{ padding: '3rem', textAlign: 'center' }}>
          <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 1rem', color: '#6366f1' }} />
          <p style={{ color: 'var(--text-muted)' }}>Loading live notifications from database...</p>
        </ClayCard>
      ) : notifications.length === 0 ? (
        <ClayCard variant="inset" style={{ padding: '3rem', textAlign: 'center' }}>
          <Bell size={40} style={{ margin: '0 auto 1rem', color: '#94a3b8' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>No Notifications Yet</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
            When exchange requests, session bookings, or credit settlements occur, they will appear here.
          </p>
        </ClayCard>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {notifications.map(n => {
            const isRead = !!n.read_at;
            return (
              <ClayCard
                key={n.id}
                variant={isRead ? 'inset' : 'raised'}
                onClick={() => !isRead && markSingleRead(n.id)}
                style={{
                  padding: '1.15rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '1rem',
                  cursor: isRead ? 'default' : 'pointer',
                  border: isRead ? '1px solid #e2e8f0' : '2px solid rgba(99, 102, 241, 0.45)',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: 'inset 1px 1px 2px rgba(255,255,255,0.8)' }}>
                  {getIcon(n.notification_type)}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {n.title}
                      </h3>
                      {!isRead && (
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6366f1' }} />
                      )}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p style={{ color: '#475569', fontSize: '0.85rem', lineHeight: 1.5, marginTop: '0.35rem' }}>
                    {n.message}
                  </p>
                </div>
              </ClayCard>
            );
          })}
        </div>
      )}
    </div>
  );
};
