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
  CheckCircle2,
  CalendarCheck,
  Sparkles,
  Edit3
} from 'lucide-react';
import { ClayCard } from '../components/clay/ClayCard';
import { ClayButton } from '../components/clay/ClayButton';
import { ClayBadge } from '../components/clay/ClayBadge';
import { ClayModal } from '../components/clay/ClayModal';
import { ClayInput } from '../components/clay/ClayInput';
import { api } from '../services/api';
import type { ServiceRequest, User as UserType } from '../types';

interface ServiceRequestsPageProps {
  currentUser: UserType;
  onNavigate: (page: string) => void;
}

export const ServiceRequestsPage: React.FC<ServiceRequestsPageProps> = ({ currentUser, onNavigate }) => {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'received' | 'sent'>('all');

  // Teacher Schedule Appointment Modal State
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [scheduleDateTime, setScheduleDateTime] = useState('');
  const [scheduleDuration, setScheduleDuration] = useState(60);
  const [scheduleMeetingLink, setScheduleMeetingLink] = useState('');
  const [isScheduling, setIsScheduling] = useState(false);

  useEffect(() => {
    loadRequests();
  }, [currentUser]);

  const loadRequests = async () => {
    const list = await api.getRequests();
    setRequests(list);
  };

  const handleOpenScheduleModal = (req: ServiceRequest) => {
    setSelectedRequest(req);
    // Format proposed start time for datetime-local input (YYYY-MM-DDTHH:mm)
    try {
      const d = req.proposed_start_at ? new Date(req.proposed_start_at) : new Date(Date.now() + 3600000);
      const pad = (n: number) => String(n).padStart(2, '0');
      const formatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      setScheduleDateTime(formatted);
    } catch {
      setScheduleDateTime('');
    }
    setScheduleDuration(req.requested_duration_minutes || 60);
    setScheduleMeetingLink(req.meeting_room_id || '');
    setScheduleModalOpen(true);
  };

  const handleConfirmSchedule = async () => {
    if (!selectedRequest) return;
    if (!scheduleDateTime) {
      alert('Please choose an appointment date and time.');
      return;
    }
    setIsScheduling(true);
    try {
      const formattedTs = scheduleDateTime.replace('T', ' ') + (scheduleDateTime.length === 16 ? ':00' : '');
      await api.scheduleRequest(
        selectedRequest.id,
        formattedTs,
        scheduleDuration,
        scheduleMeetingLink.trim()
      );
      alert('Appointment successfully scheduled! The learner has been notified with the confirmed date & time.');
      setScheduleModalOpen(false);
      await loadRequests();
    } catch (err: any) {
      alert('Failed to schedule appointment: ' + (err?.message || 'Error occurred'));
    } finally {
      setIsScheduling(false);
    }
  };

  const handleEnterClassroom = (req: ServiceRequest) => {
    if (req.session_id) {
      sessionStorage.removeItem(`tc_ended_session_${req.session_id}`);
      sessionStorage.setItem('active_classroom_session_id', String(req.session_id));
    }
    onNavigate('classroom');
  };

  const handleAccept = async (id: number) => {
    try {
      const res = await api.acceptRequest(id);
      if (res?.session_id) {
        sessionStorage.removeItem(`tc_ended_session_${res.session_id}`);
        sessionStorage.setItem('active_classroom_session_id', String(res.session_id));
      }
      await loadRequests();
      alert('Session started! Entering live classroom...');
      onNavigate('classroom');
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

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return 'Flexible / Not set';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
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
          const isScheduled = req.status === 'Scheduled' || req.status === 'Accepted';
          const isTeacher = req.teacher_id === currentUser.id;

          let badgeVariant: 'amber' | 'mint' | 'rose' | 'sky' = 'amber';
          if (req.status === 'Scheduled') badgeVariant = 'sky';
          else if (req.status === 'Accepted' || req.status === 'Completed') badgeVariant = 'mint';
          else if (req.status === 'Rejected') badgeVariant = 'rose';

          return (
            <ClayCard key={req.id} variant="raised" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                    <ClayBadge variant={badgeVariant}>
                      {req.status === 'Scheduled' ? '📅 SCHEDULED' : req.status.toUpperCase()}
                    </ClayBadge>
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
                    <span>⏱ Duration: <strong>{req.requested_duration_minutes} mins</strong></span>
                    <span>
                      📅 {req.status === 'Scheduled' ? 'Confirmed Appointment:' : 'Requested Time:'}{' '}
                      <strong style={{ color: req.status === 'Scheduled' ? '#4338ca' : 'inherit' }}>
                        {formatDateTime(req.proposed_start_at)}
                      </strong>
                    </span>
                  </div>

                  {req.message && (
                    <div style={{ marginTop: '0.65rem', padding: '0.5rem 0.85rem', background: '#f1f5f9', borderRadius: '10px', fontSize: '0.8rem', color: '#334155' }}>
                      💬 "{req.message}"
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.6rem' }}>
                  {isPending && isTeacher && (
                    <>
                      <ClayButton size="sm" variant="mint" onClick={() => handleOpenScheduleModal(req)} icon={<CalendarCheck size={14} />}>
                        Schedule Appointment
                      </ClayButton>
                      <ClayButton size="sm" variant="secondary" onClick={() => handleAccept(req.id)} icon={<Check size={14} />}>
                        Start Immediately
                      </ClayButton>
                      <ClayButton size="sm" variant="danger" onClick={() => handleReject(req.id)} icon={<X size={14} />}>
                        Reject
                      </ClayButton>
                    </>
                  )}

                  {isPending && !isTeacher && (
                    <span style={{ fontSize: '0.825rem', color: '#64748b', fontStyle: 'italic' }}>
                      Waiting for teacher to schedule meeting time...
                    </span>
                  )}

                  {isScheduled && (
                    <>
                      {isTeacher ? (
                        <>
                          <ClayButton
                            size="sm"
                            variant="secondary"
                            onClick={() => handleOpenScheduleModal(req)}
                            icon={<Edit3 size={14} />}
                          >
                            Reschedule
                          </ClayButton>
                          <ClayButton
                            size="sm"
                            variant="primary"
                            onClick={() => handleEnterClassroom(req)}
                            icon={<Video size={14} />}
                          >
                            Enter Live Classroom
                          </ClayButton>
                        </>
                      ) : (
                        <ClayButton
                          size="sm"
                          variant="primary"
                          onClick={() => handleEnterClassroom(req)}
                          icon={<Video size={14} />}
                        >
                          Join Scheduled Class
                        </ClayButton>
                      )}
                    </>
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

      {/* Teacher Schedule Appointment Modal */}
      <ClayModal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        title="📅 Schedule Appointment with Learner"
      >
        {selectedRequest && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
            <div style={{ padding: '0.85rem 1rem', borderRadius: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ color: '#64748b' }}>Learner:</span>
                <strong>{selectedRequest.learner_name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ color: '#64748b' }}>Topic / Subject:</span>
                <strong>{selectedRequest.offer_title}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ color: '#64748b' }}>Learner's Requested Time:</span>
                <span style={{ color: '#4338ca', fontWeight: 600 }}>{formatDateTime(selectedRequest.proposed_start_at)}</span>
              </div>
              {selectedRequest.message && (
                <div style={{ marginTop: '0.45rem', paddingTop: '0.45rem', borderTop: '1px dashed #cbd5e1', color: '#475569' }}>
                  💬 "{selectedRequest.message}"
                </div>
              )}
            </div>

            <p style={{ color: '#475569', fontSize: '0.875rem', margin: 0, lineHeight: 1.5 }}>
              Confirm or select the scheduled date & time for this class. The learner will be notified immediately and can join the class from their dashboard.
            </p>

            <ClayInput
              label="Scheduled Appointment Date & Time"
              type="datetime-local"
              value={scheduleDateTime}
              onChange={(e) => setScheduleDateTime(e.target.value)}
            />

            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '0.4rem' }}>
                Class Duration
              </label>
              <select
                className="clay-select"
                value={scheduleDuration}
                onChange={(e) => setScheduleDuration(Number(e.target.value))}
              >
                <option value={15}>15 Minutes</option>
                <option value={30}>30 Minutes</option>
                <option value={45}>45 Minutes</option>
                <option value={60}>60 Minutes (1 hour)</option>
                <option value={90}>90 Minutes (1.5 hours)</option>
                <option value={120}>120 Minutes (2 hours)</option>
              </select>
            </div>

            <ClayInput
              label="Meeting Room Link / Google Meet URL (Optional)"
              placeholder="e.g. https://meet.google.com/xyz-abcd-efg (or leave blank to use in-built video)"
              value={scheduleMeetingLink}
              onChange={(e) => setScheduleMeetingLink(e.target.value)}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <ClayButton variant="secondary" onClick={() => setScheduleModalOpen(false)}>
                Cancel
              </ClayButton>
              <ClayButton
                variant="primary"
                onClick={handleConfirmSchedule}
                disabled={isScheduling}
                icon={<CalendarCheck size={16} />}
              >
                {isScheduling ? 'Scheduling...' : 'Confirm & Schedule Appointment'}
              </ClayButton>
            </div>
          </div>
        )}
      </ClayModal>
    </div>
  );
};
