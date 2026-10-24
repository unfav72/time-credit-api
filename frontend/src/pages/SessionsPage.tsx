import React, { useState, useEffect } from 'react';
import {
  CalendarCheck,
  Video,
  Star,
  Clock,
  Coins,
  ShieldCheck,
  CheckCircle2,
  MessageSquare
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

export const SessionsPage: React.FC<SessionsPageProps> = ({ currentUser, onNavigate }) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  useEffect(() => {
    loadSessions();
  }, [currentUser]);

  const loadSessions = async () => {
    const list = await api.getSessions();
    setSessions(list);
  };

  const [submittingReview, setSubmittingReview] = useState(false);

  const handleOpenReview = (session: Session) => {
    setSelectedSession(session);
    setRating(5);
    setComment('');
    setReviewModalOpen(true);
  };

  const handleSubmitReview = async () => {
    if (!selectedSession) return;
    setSubmittingReview(true);
    try {
      await api.submitReview(selectedSession.id, rating, comment);
      selectedSession.rating = rating;
      selectedSession.review_comment = comment;
      setReviewModalOpen(false);
      await loadSessions();
    } catch (err: any) {
      alert('Error submitting review: ' + err?.message);
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleJoinClassroom = async (session: Session) => {
    try {
      await api.joinSession(session.id);
    } catch {}
    onNavigate('classroom');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>My Learning & Teaching Sessions</h1>
            <ClayBadge variant="mint">Live Sessions</ClayBadge>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Manage scheduled classroom dates, join live video rooms, and review completed lessons.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <ClayButton variant="primary" onClick={() => onNavigate('browse')} icon={<Video size={16} />}>
            + Host Live Session
          </ClayButton>
          <ClayButton variant="secondary" onClick={() => onNavigate('classroom')} icon={<Video size={16} />}>
            Open Classroom
          </ClayButton>
        </div>
      </div>

      {/* Sessions List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {sessions.map(sess => {
          const isCompleted = sess.status === 'COMPLETED';
          const isScheduled = sess.status === 'SCHEDULED' || sess.status === 'IN_PROGRESS';

          return (
            <ClayCard key={sess.id} variant="raised" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                    <ClayBadge variant={isCompleted ? 'mint' : 'amber'}>
                      {sess.status}
                    </ClayBadge>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Session #SES-00{sess.id}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    {sess.offer_title}
                  </h3>

                  <div style={{ fontSize: '0.825rem', color: '#475569', display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '0.4rem' }}>
                    <span>👨‍🏫 Teacher: <strong>{sess.teacher_name}</strong></span>
                    <span>👨‍🎓 Learner: <strong>{sess.learner_name}</strong></span>
                    <span>⏱ Eligible Duration: <strong>{sess.eligible_duration_minutes || 60} mins</strong></span>
                    <span>🔑 Jitsi Room: <code style={{ fontFamily: 'var(--font-mono)' }}>{sess.meeting_room_id}</code></span>
                  </div>

                  {/* Review snippet if completed */}
                  {isCompleted && sess.review_comment && (
                    <div style={{ marginTop: '0.65rem', padding: '0.6rem 0.85rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.8rem' }}>
                      <div style={{ color: '#f59e0b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        {'★'.repeat(Math.max(1, Math.min(5, Math.round(Number(sess.rating) || 5))))} <span style={{ color: '#64748b' }}>Verified Review</span>
                      </div>
                      <div style={{ color: '#334155', marginTop: '0.2rem' }}>"{sess.review_comment}"</div>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  {isScheduled && (
                    <ClayButton variant="mint" onClick={() => handleJoinClassroom(sess)} icon={<Video size={14} />}>
                      Join Classroom
                    </ClayButton>
                  )}

                  {isCompleted && !sess.review_comment && (
                    <ClayButton variant="secondary" onClick={() => handleOpenReview(sess)} icon={<Star size={14} />}>
                      Leave Review
                    </ClayButton>
                  )}
                </div>
              </div>
            </ClayCard>
          );
        })}
      </div>

      {/* Review Modal */}
      <ClayModal
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        title={`Review Session: ${selectedSession?.offer_title}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '0.4rem' }}>
              Rating
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '1.75rem',
                    color: star <= rating ? '#f59e0b' : '#cbd5e1',
                    cursor: 'pointer'
                  }}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          <ClayInput
            label="Feedback & Knowledge Acquired"
            placeholder="How was the teacher's explanation? What skill concepts did you learn?"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <ClayButton variant="secondary" onClick={() => setReviewModalOpen(false)}>
              Cancel
            </ClayButton>
            <ClayButton variant="primary" onClick={handleSubmitReview} disabled={submittingReview}>
              {submittingReview ? 'Submitting...' : 'Submit Review'}
            </ClayButton>
          </div>
        </div>
      </ClayModal>
    </div>
  );
};
