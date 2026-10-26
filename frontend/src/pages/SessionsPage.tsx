import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarCheck,
  Video,
  Star,
  Clock,
  Coins,
  ShieldCheck,
  CheckCircle2,
  Search,
  Plus,
  Play,
  User,
  GraduationCap,
  Calendar,
  AlertCircle,
  BookOpen,
  RefreshCw,
  Copy,
  Check,
  X,
  Layers
} from 'lucide-react';
import { ClayCard } from '../components/clay/ClayCard';
import { ClayButton } from '../components/clay/ClayButton';
import { ClayBadge } from '../components/clay/ClayBadge';
import { ClayModal } from '../components/clay/ClayModal';
import { ClayInput } from '../components/clay/ClayInput';
import { api } from '../services/api';
import type { Session, User as UserType } from '../types';

interface SessionsPageProps {
  currentUser: UserType;
  onNavigate: (page: string) => void;
}

type TabType = 'all' | 'scheduled' | 'live' | 'teaching' | 'learning' | 'completed';

export const SessionsPage: React.FC<SessionsPageProps> = ({ currentUser, onNavigate }) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab & Search filter
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Joining state for feedback
  const [joiningId, setJoiningId] = useState<number | null>(null);
  const [copiedRoomId, setCopiedRoomId] = useState<string | null>(null);

  // Quick Join by Room Code
  const [quickRoomCode, setQuickRoomCode] = useState('');

  // Review Modal State
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // Host Live Session Modal State
  const [hostModalOpen, setHostModalOpen] = useState(false);
  const [hostTitle, setHostTitle] = useState('');
  const [hostSkill, setHostSkill] = useState('');
  const [hostRate, setHostRate] = useState(1.0);
  const [hostDuration, setHostDuration] = useState(60);
  const [hostDesc, setHostDesc] = useState('');
  const [isHosting, setIsHosting] = useState(false);

  useEffect(() => {
    loadSessions();
  }, [currentUser]);

  const loadSessions = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.getSessions();
      setSessions(list || []);
    } catch (err: any) {
      console.error('Failed to load sessions:', err);
      setError(err?.message || 'Could not load sessions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyRoomId = (e: React.MouseEvent, roomId: string) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(roomId);
    setCopiedRoomId(roomId);
    setTimeout(() => setCopiedRoomId(null), 2000);
  };

  const handleJoinClassroom = async (session: Session) => {
    setJoiningId(session.id);
    try {
      sessionStorage.removeItem(`tc_ended_session_${session.id}`);
      sessionStorage.setItem('active_classroom_session_id', String(session.id));
      await api.joinSession(session.id).catch(() => {});
      onNavigate('classroom');
    } catch (err: any) {
      alert('Error entering session: ' + (err?.message || 'Please try again.'));
      setJoiningId(null);
    }
  };

  const handleQuickJoin = async () => {
    const code = quickRoomCode.trim();
    if (!code) {
      alert('Please enter a Google Meet room code or Session ID.');
      return;
    }

    // Check if it matches a session in the user's list
    const match = sessions.find(
      s => s.meeting_room_id.toLowerCase() === code.toLowerCase() || String(s.id) === code
    );

    if (match) {
      handleJoinClassroom(match);
      return;
    }

    // If not found locally, store room ID and jump to classroom
    sessionStorage.setItem('active_classroom_session_id', code);
    onNavigate('classroom');
  };

  const handleOpenReview = (session: Session) => {
    setSelectedSession(session);
    setRating(session.rating ? Math.round(session.rating) : 5);
    setComment(session.review_comment || '');
    setReviewModalOpen(true);
  };

  const handleSubmitReview = async () => {
    if (!selectedSession) return;
    setSubmittingReview(true);
    try {
      await api.submitReview(selectedSession.id, rating, comment.trim());
      // Update local state
      setSessions(prev =>
        prev.map(s => (s.id === selectedSession.id ? { ...s, rating, review_comment: comment.trim() } : s))
      );
      setReviewModalOpen(false);
    } catch (err: any) {
      alert('Error submitting review: ' + (err?.message || 'Please check your connection.'));
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleStartHostSession = async () => {
    if (!hostTitle.trim()) {
      alert('Please enter a session title or topic.');
      return;
    }
    setIsHosting(true);
    try {
      const res = await api.createTeachingSession({
        title: hostTitle.trim(),
        skill_name: hostSkill.trim() || 'Peer Mentorship & Learning',
        credit_rate: hostRate,
        duration_minutes: hostDuration,
        description: hostDesc.trim() || 'Interactive live online teaching and learning session.'
      });
      if (res?.session_id) {
        sessionStorage.setItem('active_classroom_session_id', String(res.session_id));
      }
      setHostModalOpen(false);
      onNavigate('classroom');
    } catch (err: any) {
      alert('Error broadcasting live session: ' + (err?.message || 'Please try again.'));
    } finally {
      setIsHosting(false);
    }
  };

  // Tab counts
  const liveCount = useMemo(
    () => sessions.filter(s => s.status === 'IN_PROGRESS').length,
    [sessions]
  );
  const scheduledCount = useMemo(
    () => sessions.filter(s => s.status === 'SCHEDULED').length,
    [sessions]
  );
  const teachingCount = useMemo(
    () => sessions.filter(s => s.teacher_id === currentUser.id).length,
    [sessions, currentUser.id]
  );
  const learningCount = useMemo(
    () => sessions.filter(s => s.learner_id === currentUser.id).length,
    [sessions, currentUser.id]
  );
  const completedCount = useMemo(
    () => sessions.filter(s => s.status === 'COMPLETED').length,
    [sessions]
  );

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter(sess => {
      // Tab filter
      if (activeTab === 'live' && sess.status !== 'IN_PROGRESS') {
        return false;
      }
      if (activeTab === 'scheduled' && sess.status !== 'SCHEDULED') {
        return false;
      }
      if (activeTab === 'teaching' && sess.teacher_id !== currentUser.id) {
        return false;
      }
      if (activeTab === 'learning' && sess.learner_id !== currentUser.id) {
        return false;
      }
      if (activeTab === 'completed' && sess.status !== 'COMPLETED') {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = sess.offer_title?.toLowerCase().includes(q);
        const skillMatch = sess.skill_name?.toLowerCase().includes(q);
        const teacherMatch = sess.teacher_name?.toLowerCase().includes(q);
        const learnerMatch = sess.learner_name?.toLowerCase().includes(q);
        const roomMatch = sess.meeting_room_id?.toLowerCase().includes(q);
        const idMatch = String(sess.id).includes(q);
        return titleMatch || skillMatch || teacherMatch || learnerMatch || roomMatch || idMatch;
      }

      return true;
    });
  }, [sessions, activeTab, searchQuery, currentUser.id]);

  const formatSessionTime = (isoString?: string) => {
    if (!isoString) return 'Flexible / Live Broadcast';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Top Banner / Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1.25rem',
          paddingBottom: '0.5rem'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              My Learning & Teaching Sessions
            </h1>
            <ClayBadge variant="mint" icon={<CalendarCheck size={14} />}>
              Live Peer Exchange
            </ClayBadge>
            {liveCount > 0 && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: '#dc2626',
                  background: '#fee2e2',
                  padding: '0.2rem 0.65rem',
                  borderRadius: '9999px',
                  border: '1px solid #fca5a5',
                  animation: 'pulseGlow 2s infinite ease-in-out'
                }}
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#dc2626',
                    display: 'inline-block'
                  }}
                />
                {liveCount} Active Now
              </span>
            )}
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.35rem' }}>
            Track your live classroom video calls, join active learning sessions, and manage peer ratings.
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <ClayButton
            variant="secondary"
            onClick={loadSessions}
            icon={<RefreshCw size={15} className={loading ? 'spin' : ''} />}
          >
            Refresh
          </ClayButton>

          <ClayButton
            variant="secondary"
            onClick={() => onNavigate('classroom')}
            icon={<Video size={16} />}
          >
            Open Classroom
          </ClayButton>

          <ClayButton
            variant="primary"
            onClick={() => {
              setHostTitle('');
              setHostSkill('');
              setHostDesc('');
              setHostRate(1.0);
              setHostDuration(60);
              setHostModalOpen(true);
            }}
            icon={<Plus size={16} />}
          >
            + Host Live Session
          </ClayButton>
        </div>
      </div>

      {/* Quick Summary Stat Tiles */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '1rem'
        }}
      >
        <ClayCard
          variant="raised"
          style={{
            padding: '1.1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '14px',
              background: '#e0f2fe',
              color: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Layers size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Sessions</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {sessions.length}
            </div>
          </div>
        </ClayCard>

        <ClayCard
          variant="raised"
          style={{
            padding: '1.1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            background: scheduledCount > 0 ? 'linear-gradient(135deg, #fefce8 0%, #fffbeb 100%)' : 'white',
            borderColor: scheduledCount > 0 ? '#fde68a' : undefined
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '14px',
              background: scheduledCount > 0 ? '#fef3c7' : '#f1f5f9',
              color: scheduledCount > 0 ? '#d97706' : '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <CalendarCheck size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Scheduled Appointments</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: scheduledCount > 0 ? '#d97706' : 'var(--text-main)' }}>
              {scheduledCount}
            </div>
          </div>
        </ClayCard>

        <ClayCard
          variant="raised"
          style={{
            padding: '1.1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            background: liveCount > 0 ? 'linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%)' : 'white',
            borderColor: liveCount > 0 ? '#fca5a5' : undefined
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '14px',
              background: liveCount > 0 ? '#fee2e2' : '#f1f5f9',
              color: liveCount > 0 ? '#dc2626' : '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Video size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Live In-Progress</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: liveCount > 0 ? '#dc2626' : 'var(--text-main)' }}>
              {liveCount}
            </div>
          </div>
        </ClayCard>

        <ClayCard
          variant="raised"
          style={{
            padding: '1.1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '14px',
              background: '#fef3c7',
              color: '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <GraduationCap size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Teaching (Host)</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {teachingCount}
            </div>
          </div>
        </ClayCard>

        <ClayCard
          variant="raised"
          style={{
            padding: '1.1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '14px',
              background: '#d1fae5',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Completed</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {completedCount}
            </div>
          </div>
        </ClayCard>
      </div>

      {/* Filter Tabs & Quick Join Bar */}
      <ClayCard variant="raised" style={{ padding: '1rem 1.25rem' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem'
          }}
        >
          {/* Tabs */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            <button
              onClick={() => setActiveTab('all')}
              style={{
                border: 'none',
                background: activeTab === 'all' ? 'var(--primary-gradient)' : '#f1f5f9',
                color: activeTab === 'all' ? '#ffffff' : 'var(--text-muted)',
                padding: '0.5rem 1rem',
                borderRadius: '14px',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: activeTab === 'all' ? 'var(--clay-shadow-btn)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              All Sessions
              <span
                style={{
                  background: activeTab === 'all' ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                  padding: '0.1rem 0.45rem',
                  borderRadius: '10px',
                  fontSize: '0.75rem'
                }}
              >
                {sessions.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('scheduled')}
              style={{
                border: 'none',
                background: activeTab === 'scheduled' ? 'var(--primary-gradient)' : '#f1f5f9',
                color: activeTab === 'scheduled' ? '#ffffff' : 'var(--text-muted)',
                padding: '0.5rem 1rem',
                borderRadius: '14px',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: activeTab === 'scheduled' ? 'var(--clay-shadow-btn)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              📅 Scheduled Appointments
              <span
                style={{
                  background: activeTab === 'scheduled' ? 'rgba(255,255,255,0.25)' : '#fef3c7',
                  color: activeTab === 'scheduled' ? '#ffffff' : '#b45309',
                  padding: '0.1rem 0.45rem',
                  borderRadius: '10px',
                  fontSize: '0.75rem',
                  fontWeight: 800
                }}
              >
                {scheduledCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('live')}
              style={{
                border: 'none',
                background: activeTab === 'live' ? 'var(--primary-gradient)' : '#f1f5f9',
                color: activeTab === 'live' ? '#ffffff' : 'var(--text-muted)',
                padding: '0.5rem 1rem',
                borderRadius: '14px',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: activeTab === 'live' ? 'var(--clay-shadow-btn)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              🔴 Live
              <span
                style={{
                  background: activeTab === 'live' ? 'rgba(255,255,255,0.25)' : '#fee2e2',
                  color: activeTab === 'live' ? '#ffffff' : '#dc2626',
                  padding: '0.1rem 0.45rem',
                  borderRadius: '10px',
                  fontSize: '0.75rem',
                  fontWeight: 800
                }}
              >
                {liveCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('teaching')}
              style={{
                border: 'none',
                background: activeTab === 'teaching' ? 'var(--primary-gradient)' : '#f1f5f9',
                color: activeTab === 'teaching' ? '#ffffff' : 'var(--text-muted)',
                padding: '0.5rem 1rem',
                borderRadius: '14px',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: activeTab === 'teaching' ? 'var(--clay-shadow-btn)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              👨‍🏫 Teaching
              <span
                style={{
                  background: activeTab === 'teaching' ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                  padding: '0.1rem 0.45rem',
                  borderRadius: '10px',
                  fontSize: '0.75rem'
                }}
              >
                {teachingCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('learning')}
              style={{
                border: 'none',
                background: activeTab === 'learning' ? 'var(--primary-gradient)' : '#f1f5f9',
                color: activeTab === 'learning' ? '#ffffff' : 'var(--text-muted)',
                padding: '0.5rem 1rem',
                borderRadius: '14px',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: activeTab === 'learning' ? 'var(--clay-shadow-btn)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              👨‍🎓 Learning
              <span
                style={{
                  background: activeTab === 'learning' ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                  padding: '0.1rem 0.45rem',
                  borderRadius: '10px',
                  fontSize: '0.75rem'
                }}
              >
                {learningCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('completed')}
              style={{
                border: 'none',
                background: activeTab === 'completed' ? 'var(--primary-gradient)' : '#f1f5f9',
                color: activeTab === 'completed' ? '#ffffff' : 'var(--text-muted)',
                padding: '0.5rem 1rem',
                borderRadius: '14px',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: activeTab === 'completed' ? 'var(--clay-shadow-btn)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              ✅ Completed
              <span
                style={{
                  background: activeTab === 'completed' ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                  padding: '0.1rem 0.45rem',
                  borderRadius: '10px',
                  fontSize: '0.75rem'
                }}
              >
                {completedCount}
              </span>
            </button>
          </div>

          {/* Search box & Quick Join */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', flex: '1 1 300px', justifyContent: 'flex-end' }}>
            <div style={{ position: 'relative', minWidth: '220px', flex: '1 1 auto', maxWidth: '340px' }}>
              <ClayInput
                placeholder="Search by topic, skill, peer..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                icon={<Search size={15} />}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#94a3b8'
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Quick room join */}
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Room / Session ID"
                value={quickRoomCode}
                onChange={e => setQuickRoomCode(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleQuickJoin();
                }}
                className="clay-input"
                style={{
                  width: '150px',
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.825rem',
                  fontFamily: 'var(--font-mono)'
                }}
              />
              <ClayButton size="sm" variant="mint" onClick={handleQuickJoin} icon={<Play size={13} />}>
                Join
              </ClayButton>
            </div>
          </div>
        </div>
      </ClayCard>

      {/* Error state */}
      {error && (
        <ClayCard
          variant="raised"
          style={{
            padding: '1.25rem',
            background: '#fff1f2',
            border: '1px solid #fecdd3',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertCircle size={22} style={{ color: '#e11d48' }} />
            <div>
              <div style={{ fontWeight: 700, color: '#9f1239', fontSize: '0.95rem' }}>
                Error Loading Sessions
              </div>
              <div style={{ color: '#be123c', fontSize: '0.85rem' }}>{error}</div>
            </div>
          </div>
          <ClayButton size="sm" variant="primary" onClick={loadSessions}>
            Try Again
          </ClayButton>
        </ClayCard>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[1, 2, 3].map(i => (
            <ClayCard key={i} variant="raised" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <div style={{ width: '90px', height: '24px', background: '#e2e8f0', borderRadius: '8px' }} />
                  <div style={{ width: '130px', height: '24px', background: '#e2e8f0', borderRadius: '8px' }} />
                </div>
                <div style={{ width: '60%', height: '28px', background: '#e2e8f0', borderRadius: '8px' }} />
                <div style={{ width: '40%', height: '18px', background: '#e2e8f0', borderRadius: '8px' }} />
              </div>
            </ClayCard>
          ))}
        </div>
      )}

      {/* Sessions List */}
      {!loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          {filteredSessions.map(sess => {
            const isCompleted = sess.status === 'COMPLETED';
            const isInProgress = sess.status === 'IN_PROGRESS';
            const isScheduled = sess.status === 'SCHEDULED';
            const isLiveOrScheduled = isInProgress || isScheduled;

            const isTeacher = sess.teacher_id === currentUser.id;
            const isLearner = sess.learner_id === currentUser.id;
            const isJoining = joiningId === sess.id;

            // Determine badge variant & human-readable label
            let badgeVariant: 'mint' | 'amber' | 'rose' | 'sky' | 'lavender' = 'sky';
            let statusLabel: string = sess.status;
            if (isInProgress) {
              badgeVariant = 'rose';
              statusLabel = '🔴 LIVE NOW';
            } else if (isScheduled) {
              badgeVariant = 'amber';
              statusLabel = '📅 SCHEDULED';
            } else if (isCompleted) {
              badgeVariant = 'mint';
              statusLabel = '✓ COMPLETED';
            } else if (sess.status === 'CANCELLED') {
              badgeVariant = 'rose';
              statusLabel = '✕ CANCELLED';
            } else if (sess.status === 'DISPUTED') {
              badgeVariant = 'lavender';
              statusLabel = '⚠ DISPUTED';
            }

            return (
              <ClayCard
                key={sess.id}
                variant="raised"
                style={{
                  padding: '1.5rem',
                  border: isInProgress ? '2px solid #f87171' : undefined,
                  boxShadow: isInProgress
                    ? '0 10px 25px -5px rgba(239, 68, 68, 0.15), var(--clay-shadow-raised)'
                    : undefined,
                  transition: 'all 0.2s ease'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '1.25rem'
                  }}
                >
                  {/* Left / Info Column */}
                  <div style={{ flex: '1 1 500px', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {/* Header Badges */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                      <ClayBadge variant={badgeVariant}>{statusLabel}</ClayBadge>

                      {/* User Role Tag */}
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '0.2rem 0.6rem',
                          borderRadius: '8px',
                          background: isTeacher ? '#ede9fe' : '#e0f2fe',
                          color: isTeacher ? '#5b21b6' : '#0369a1',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem'
                        }}
                      >
                        {isTeacher ? '👨‍🏫 You are Teaching' : isLearner ? '👨‍🎓 You are Learning' : '👥 Participant'}
                      </span>

                      {/* Skill Tag */}
                      {sess.skill_name && (
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            padding: '0.2rem 0.55rem',
                            borderRadius: '8px',
                            background: '#f1f5f9',
                            color: '#475569'
                          }}
                        >
                          ⚡ {sess.skill_name}
                        </span>
                      )}

                      <span style={{ fontSize: '0.775rem', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
                        #SES-{String(sess.id).padStart(4, '0')}
                      </span>
                    </div>

                    {/* Title */}
                    <h3
                      style={{
                        fontSize: '1.35rem',
                        fontWeight: 800,
                        color: 'var(--text-main)',
                        letterSpacing: '-0.01em',
                        lineHeight: 1.3
                      }}
                    >
                      {sess.offer_title || 'Live Teaching Class'}
                    </h3>

                    {/* Key Attributes Grid */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '0.65rem',
                        fontSize: '0.85rem',
                        color: '#475569',
                        marginTop: '0.25rem',
                        background: '#f8fafc',
                        padding: '0.85rem 1rem',
                        borderRadius: '14px',
                        border: '1px solid #e2e8f0'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <User size={15} style={{ color: '#6366f1' }} />
                        <span>
                          Teacher: <strong style={{ color: 'var(--text-main)' }}>{sess.teacher_name}</strong>
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <GraduationCap size={15} style={{ color: '#0284c7' }} />
                        <span>
                          Learner: <strong style={{ color: 'var(--text-main)' }}>{sess.learner_name || 'Open Learner'}</strong>
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Calendar size={15} style={{ color: '#f59e0b' }} />
                        <span>
                          Date: <strong>{formatSessionTime(sess.actual_start_at || sess.scheduled_start_at)}</strong>
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Clock size={15} style={{ color: '#10b981' }} />
                        <span>
                          Eligible Duration: <strong>{sess.eligible_duration_minutes || 60} mins</strong>
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Coins size={15} style={{ color: '#8b5cf6' }} />
                        <span>
                          Credit Rate: <strong>{sess.credit_rate != null ? Number(sess.credit_rate).toFixed(2) : '1.00'} TC / hr</strong>
                        </span>
                      </div>

                      {sess.settled_credits != null && Number(sess.settled_credits) > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <ShieldCheck size={15} style={{ color: '#16a34a' }} />
                          <span>
                            Settled: <strong style={{ color: '#15803d' }}>{Number(sess.settled_credits).toFixed(2)} TC</strong>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Room Code Badge with Copy button */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.2rem' }}>
                      <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Google Meet Room Code:</span>
                      <code
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.825rem',
                          fontWeight: 700,
                          background: '#e0f2fe',
                          color: '#0369a1',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '8px',
                          border: '1px solid #bae6fd'
                        }}
                      >
                        {sess.meeting_room_id}
                      </code>
                      <button
                        type="button"
                        onClick={e => handleCopyRoomId(e, sess.meeting_room_id)}
                        title="Copy Room ID"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#64748b',
                          display: 'flex',
                          alignItems: 'center',
                          padding: '4px'
                        }}
                      >
                        {copiedRoomId === sess.meeting_room_id ? (
                          <Check size={14} style={{ color: '#16a34a' }} />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                    </div>

                    {/* Review Snippets */}
                    {isCompleted && (sess.review_comment || sess.received_comment) && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.4rem' }}>
                        {sess.review_comment && (
                          <div
                            style={{
                              padding: '0.65rem 0.85rem',
                              background: '#f8fafc',
                              borderRadius: '12px',
                              border: '1px solid #e2e8f0',
                              fontSize: '0.825rem'
                            }}
                          >
                            <div
                              style={{
                                color: '#f59e0b',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem'
                              }}
                            >
                              {'★'.repeat(Math.max(1, Math.min(5, Math.round(Number(sess.rating) || 5))))}
                              <span style={{ color: '#64748b', fontWeight: 600 }}>Your Feedback Given</span>
                            </div>
                            <div style={{ color: '#334155', marginTop: '0.2rem', fontStyle: 'italic' }}>
                              "{sess.review_comment}"
                            </div>
                          </div>
                        )}

                        {sess.received_comment && (
                          <div
                            style={{
                              padding: '0.65rem 0.85rem',
                              background: '#f0fdf4',
                              borderRadius: '12px',
                              border: '1px solid #bbf7d0',
                              fontSize: '0.825rem'
                            }}
                          >
                            <div
                              style={{
                                color: '#16a34a',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem'
                              }}
                            >
                              {'★'.repeat(Math.max(1, Math.min(5, Math.round(Number(sess.received_rating) || 5))))}
                              <span style={{ color: '#15803d', fontWeight: 600 }}>Feedback Received from Peer</span>
                            </div>
                            <div style={{ color: '#166534', marginTop: '0.2rem', fontStyle: 'italic' }}>
                              "{sess.received_comment}"
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right / Actions Column */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: '0.75rem',
                      alignSelf: 'center'
                    }}
                  >
                    {/* Enter Classroom Action */}
                    {isInProgress && (
                      <ClayButton
                        variant="mint"
                        size="md"
                        onClick={() => handleJoinClassroom(sess)}
                        disabled={isJoining}
                        icon={<Video size={16} />}
                        style={{
                          fontWeight: 800,
                          padding: '0.7rem 1.4rem',
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          color: '#ffffff'
                        }}
                      >
                        {isJoining ? 'Entering Classroom...' : '🔴 Enter Live Classroom Now ➔'}
                      </ClayButton>
                    )}

                    {isScheduled && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', alignItems: 'flex-end' }}>
                        <ClayButton
                          variant={isTeacher ? 'primary' : 'mint'}
                          size="md"
                          onClick={() => handleJoinClassroom(sess)}
                          disabled={isJoining}
                          icon={isTeacher ? <Play size={15} /> : <Video size={15} />}
                          style={{
                            fontWeight: 800,
                            padding: '0.7rem 1.4rem',
                            background: isTeacher 
                              ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' 
                              : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                            color: '#ffffff'
                          }}
                        >
                          {isJoining
                            ? 'Entering...'
                            : isTeacher
                            ? '🚀 Start Class & Enter Live Classroom'
                            : '🎥 Join Scheduled Class'}
                        </ClayButton>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                          {isTeacher ? 'Teacher launches and activates class' : 'Learner enters classroom'}
                        </span>
                      </div>
                    )}

                    {/* Review Action */}
                    {isCompleted && (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <ClayButton
                          variant="secondary"
                          size="sm"
                          onClick={() => handleOpenReview(sess)}
                          icon={<Star size={14} style={{ color: '#f59e0b' }} />}
                        >
                          {sess.review_comment ? 'Edit Review' : 'Leave Review'}
                        </ClayButton>
                      </div>
                    )}
                  </div>
                </div>
              </ClayCard>
            );
          })}

          {/* Empty State */}
          {filteredSessions.length === 0 && (
            <ClayCard
              variant="raised"
              style={{
                padding: '4rem 2rem',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1rem'
              }}
            >
              <div
                style={{
                  width: '68px',
                  height: '68px',
                  borderRadius: '20px',
                  background: '#f1f5f9',
                  color: '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {activeTab === 'live' ? (
                  <Video size={34} style={{ color: '#6366f1' }} />
                ) : (
                  <CalendarCheck size={34} />
                )}
              </div>

              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  {activeTab === 'live'
                    ? 'No Active Live Sessions Right Now'
                    : activeTab === 'completed'
                    ? 'No Completed Sessions Yet'
                    : activeTab === 'teaching'
                    ? 'You Have Not Hosted Any Sessions Yet'
                    : activeTab === 'learning'
                    ? 'No Learning Sessions Found'
                    : searchQuery
                    ? 'No Sessions Match Your Search Query'
                    : 'No Classroom Sessions Yet'}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '440px', marginTop: '0.35rem' }}>
                  {activeTab === 'live'
                    ? 'Start broadcasting your own live peer learning room or browse services to book a mentor!'
                    : 'Exchange your skills, host live video classes, and earn Time Credits on the platform.'}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                <ClayButton
                  variant="primary"
                  onClick={() => {
                    setHostTitle('');
                    setHostSkill('');
                    setHostDesc('');
                    setHostRate(1.0);
                    setHostDuration(60);
                    setHostModalOpen(true);
                  }}
                  icon={<Plus size={15} />}
                >
                  + Host Live Session
                </ClayButton>

                <ClayButton variant="secondary" onClick={() => onNavigate('browse')} icon={<BookOpen size={15} />}>
                  Browse Skill Offers
                </ClayButton>
              </div>
            </ClayCard>
          )}
        </div>
      )}

      {/* Review Modal */}
      <ClayModal
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        title={`Review Session: ${selectedSession?.offer_title || 'Live Class'}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label
              style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                color: 'var(--text-main)',
                display: 'block',
                marginBottom: '0.5rem'
              }}
            >
              How would you rate this exchange?
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '2rem',
                    color: star <= rating ? '#f59e0b' : '#cbd5e1',
                    cursor: 'pointer',
                    transition: 'transform 0.1s ease',
                    padding: '0.2rem'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.2)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  ★
                </button>
              ))}
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f59e0b', marginLeft: '0.5rem' }}>
                {rating === 5 ? '5.0 - Exceptional' : rating === 4 ? '4.0 - Very Good' : rating === 3 ? '3.0 - Good' : rating === 2 ? '2.0 - Fair' : '1.0 - Poor'}
              </span>
            </div>
          </div>

          <ClayInput
            label="Feedback & Knowledge Acquired"
            placeholder="Share what skill concepts were mastered, quality of explanation, or suggestions..."
            value={comment}
            onChange={e => setComment(e.target.value)}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <ClayButton variant="secondary" onClick={() => setReviewModalOpen(false)}>
              Cancel
            </ClayButton>
            <ClayButton variant="primary" onClick={handleSubmitReview} disabled={submittingReview}>
              {submittingReview ? 'Submitting...' : 'Submit Verified Review'}
            </ClayButton>
          </div>
        </div>
      </ClayModal>

      {/* Host Live Session Modal */}
      <ClayModal
        isOpen={hostModalOpen}
        onClose={() => setHostModalOpen(false)}
        title="Host a Live Peer Teaching Session"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Broadcast an interactive live video classroom. Learners can join, and credits will be automatically credited to your wallet according to your teaching time!
          </p>

          <ClayInput
            label="Session Topic / Title *"
            placeholder="e.g. Master PostgreSQL Query Optimization & Indexes"
            value={hostTitle}
            onChange={e => setHostTitle(e.target.value)}
          />

          <ClayInput
            label="Skill or Category"
            placeholder="e.g. PostgreSQL, Python, React, Data Structures"
            value={hostSkill}
            onChange={e => setHostSkill(e.target.value)}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <ClayInput
              label="Credit Rate (TC / hour)"
              type="number"
              step="0.25"
              min="0.25"
              max="10"
              value={hostRate}
              onChange={e => setHostRate(parseFloat(e.target.value) || 1.0)}
            />

            <ClayInput
              label="Duration (minutes)"
              type="number"
              step="15"
              min="15"
              max="240"
              value={hostDuration}
              onChange={e => setHostDuration(parseInt(e.target.value, 10) || 60)}
            />
          </div>

          <ClayInput
            label="Session Description / Objectives"
            placeholder="Briefly outline what you will teach or walk through in this session..."
            value={hostDesc}
            onChange={e => setHostDesc(e.target.value)}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <ClayButton variant="secondary" onClick={() => setHostModalOpen(false)}>
              Cancel
            </ClayButton>
            <ClayButton variant="primary" onClick={handleStartHostSession} disabled={isHosting} icon={<Video size={16} />}>
              {isHosting ? 'Broadcasting...' : '🚀 Broadcast & Enter Classroom'}
            </ClayButton>
          </div>
        </div>
      </ClayModal>
    </div>
  );
};
