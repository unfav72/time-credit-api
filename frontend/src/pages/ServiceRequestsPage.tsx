import React, { useState, useEffect } from 'react';
import {
  Inbox,
  Check,
  X,
  Clock,
  User,
  Calendar,
  MessageSquare,
  Video,
  CheckCircle2
} from 'lucide-react';
import { ClayCard } from '../components/clay/ClayCard';
import { ClayButton } from '../components/clay/ClayButton';
import { ClayBadge } from '../components/clay/ClayBadge';
import { api } from '../services/api';
import type { ServiceRequest, User as UserType } from '../types';

interface ServiceRequestsPageProps {
  currentUser: UserType;
  onNavigate: (page: string) => void;
}

export const ServiceRequestsPage: React.FC<ServiceRequestsPageProps> = ({ currentUser, onNavigate }) => {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'received' | 'sent'>('all');

  useEffect(() => {
    loadRequests();
  }, [currentUser]);

  const loadRequests = async () => {
    const list = await api.getRequests();
    setRequests(list);
  };

  const handleAccept = async (id: number) => {
    try {
      await api.acceptRequest(id);
      await loadRequests();
      alert('Request accepted! Live session scheduled.');
    } catch (e: any) {
      alert('Error: ' + e?.message);
    }
  };

  const handleReject = async (id: number) => {
    try {
      await api.rejectRequest(id);
      await loadRequests();
    } catch (e: any) {
      alert('Error: ' + e?.message);
    }
  };

  const filtered = requests.filter(r => {
    if (activeTab === 'received') return r.teacher_id === currentUser.id;
    if (activeTab === 'sent') return r.learner_id === currentUser.id;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Service Requests</h1>
            <ClayBadge variant="sky">Session Lifecycle</ClayBadge>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            State transitions: <code>Pending</code> ➔ <code>Accepted</code> ➔ <code>Scheduled</code> ➔ <code>Completed</code>.
          </p>
        </div>

        {/* Tab Filters */}
        <div style={{ display: 'flex', background: 'var(--clay-surface)', padding: '0.25rem', borderRadius: '16px', boxShadow: 'var(--clay-shadow-btn)' }}>
          <button
            onClick={() => setActiveTab('all')}
            style={{
              border: 'none',
              padding: '0.4rem 0.85rem',
              borderRadius: '12px',
              background: activeTab === 'all' ? 'var(--pastel-lavender-bg)' : 'transparent',
              color: activeTab === 'all' ? '#4338ca' : '#64748b',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            All Requests ({requests.length})
          </button>
          <button
            onClick={() => setActiveTab('received')}
            style={{
              border: 'none',
              padding: '0.4rem 0.85rem',
              borderRadius: '12px',
              background: activeTab === 'received' ? 'var(--pastel-lavender-bg)' : 'transparent',
              color: activeTab === 'received' ? '#4338ca' : '#64748b',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            Received as Teacher
          </button>
          <button
            onClick={() => setActiveTab('sent')}
            style={{
              border: 'none',
              padding: '0.4rem 0.85rem',
              borderRadius: '12px',
              background: activeTab === 'sent' ? 'var(--pastel-lavender-bg)' : 'transparent',
              color: activeTab === 'sent' ? '#4338ca' : '#64748b',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            Sent as Learner
          </button>
        </div>
      </div>

      {/* Requests List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {filtered.map(req => {
          const isPending = req.status === 'Pending';
          const isTeacher = req.teacher_id === currentUser.id;

          let badgeVariant: 'amber' | 'mint' | 'rose' | 'sky' = 'amber';
          if (req.status === 'Accepted' || req.status === 'Completed') badgeVariant = 'mint';
          if (req.status === 'Rejected') badgeVariant = 'rose';

          return (
            <ClayCard key={req.id} variant="raised" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                    <ClayBadge variant={badgeVariant}>{req.status.toUpperCase()}</ClayBadge>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Request #SR-00{req.id}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    {req.offer_title}
                  </h3>

                  <div style={{ fontSize: '0.825rem', color: '#475569', display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '0.4rem' }}>
                    <span>👨‍🏫 Teacher: <strong>{req.teacher_name}</strong></span>
                    <span>👨‍🎓 Learner: <strong>{req.learner_name}</strong></span>
                    <span>⏱ Proposed Duration: <strong>{req.requested_duration_minutes} mins</strong></span>
                    <span>📅 Start: <strong>{req.proposed_start_at}</strong></span>
                  </div>

                  {req.message && (
                    <div style={{ marginTop: '0.65rem', padding: '0.5rem 0.85rem', background: '#f1f5f9', borderRadius: '10px', fontSize: '0.8rem', color: '#334155' }}>
                      💬 "{req.message}"
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  {isPending && isTeacher && (
                    <>
                      <ClayButton size="sm" variant="mint" onClick={() => handleAccept(req.id)} icon={<Check size={14} />}>
                        Accept & Schedule
                      </ClayButton>
                      <ClayButton size="sm" variant="danger" onClick={() => handleReject(req.id)} icon={<X size={14} />}>
                        Reject
                      </ClayButton>
                    </>
                  )}

                  {req.status === 'Accepted' && (
                    <ClayButton size="sm" variant="primary" onClick={() => onNavigate('classroom')} icon={<Video size={14} />}>
                      Join Live Classroom
                    </ClayButton>
                  )}
                </div>
              </div>
            </ClayCard>
          );
        })}

        {filtered.length === 0 && (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            <Inbox size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
            <div>No service requests in this view.</div>
          </div>
        )}
      </div>
    </div>
  );
};
