import React, { useState, useEffect } from 'react';
import {
  Search,
  Star,
  Clock,
  Coins,
  Globe,
  Calendar,
  CheckCircle2,
  Video,
  User,
  Filter,
  AlertCircle,
  PlusCircle,
  CreditCard,
  Sparkles,
  Radio
} from 'lucide-react';
import { ClayCard } from '../components/clay/ClayCard';
import { ClayButton } from '../components/clay/ClayButton';
import { ClayBadge } from '../components/clay/ClayBadge';
import { ClayModal } from '../components/clay/ClayModal';
import { ClayInput } from '../components/clay/ClayInput';
import { api } from '../services/api';
import type { ServiceOffer, User as UserType, Session } from '../types';

interface BrowseServicesPageProps {
  currentUser: UserType;
  onNavigate: (page: string) => void;
  onOpenTopUp: () => void;
}

export const BrowseServicesPage: React.FC<BrowseServicesPageProps> = ({ currentUser, onNavigate, onOpenTopUp }) => {
  const [offers, setOffers] = useState<ServiceOffer[]>([]);
  const [liveSessions, setLiveSessions] = useState<Session[]>([]);
  const [selectedOffer, setSelectedOffer] = useState<ServiceOffer | null>(null);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [proposedDate, setProposedDate] = useState('2026-10-25T15:00');
  const [duration, setDuration] = useState(60);
  const [message, setMessage] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [search, setSearch] = useState('');

  // Host Live Teaching Session modal state
  const [hostModalOpen, setHostModalOpen] = useState(false);
  const [hostTitle, setHostTitle] = useState('');
  const [hostSkill, setHostSkill] = useState('');
  const [hostDuration, setHostDuration] = useState(60);
  const [hostRate, setHostRate] = useState(1.0);
  const [hostDesc, setHostDesc] = useState('');
  const [isHosting, setIsHosting] = useState(false);
  const [joiningSessionId, setJoiningSessionId] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [offerList, liveList] = await Promise.all([
        api.getOffers().catch(() => []),
        api.getLiveSessions().catch(() => [])
      ]);
      setOffers(offerList);
      setLiveSessions(liveList);
    } catch (e) {
      console.warn('Failed loading offers or live sessions:', e);
    }
  };

  const handleOpenBooking = (offer: ServiceOffer) => {
    setSelectedOffer(offer);
    setBookingSuccess(false);
    setMessage(`Hello ${offer.teacher_name}, I would love to book a session on ${offer.title}!`);
    setRequestModalOpen(true);
  };

  const handleSendRequest = async () => {
    if (!selectedOffer) return;
    try {
      await api.createRequest(selectedOffer.id, proposedDate.replace('T', ' ') + ':00', duration, message);
      setBookingSuccess(true);
    } catch (err: any) {
      alert('Error booking request: ' + err?.message);
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
        title: hostTitle,
        skill_name: hostSkill || 'Peer Teaching & Mentorship',
        credit_rate: hostRate,
        duration_minutes: hostDuration,
        description: hostDesc || 'Live interactive online teaching and learning session.'
      });
      if (res?.session_id) {
        sessionStorage.setItem('active_classroom_session_id', String(res.session_id));
      }
      setHostModalOpen(false);
      onNavigate('classroom');
    } catch (err: any) {
      alert('Error starting live session: ' + err?.message);
    } finally {
      setIsHosting(false);
    }
  };

  const handleJoinLive = async (session: Session) => {
    setJoiningSessionId(session.id);
    try {
      sessionStorage.setItem('active_classroom_session_id', String(session.id));
      await api.joinSession(session.id);
      onNavigate('classroom');
    } catch (err: any) {
      alert('Error joining live session: ' + err?.message);
    } finally {
      setJoiningSessionId(null);
    }
  };

  const filteredOffers = offers.filter(o => 
    (o.title || '').toLowerCase().includes(search.toLowerCase()) ||
    (o.teacher_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (o.description || '').toLowerCase().includes(search.toLowerCase())
  );

  const selectedRate = Number(selectedOffer?.credit_rate || 1.0);
  const requiredCredits = selectedOffer ? (duration / 60) * selectedRate : 1.0;
  const userBalance = Number(currentUser?.balance || 0);
  const hasInsufficientCredits = userBalance < requiredCredits;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Browse Live Teaching Offers</h1>
            <ClayBadge variant="mint">Peer Learning</ClayBadge>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Book 1-on-1 video sessions with expert members or broadcast your own live class online.
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          <ClayButton variant="primary" onClick={() => setHostModalOpen(true)} icon={<Video size={16} />}>
            + Host Live Teaching Session
          </ClayButton>
          <ClayButton variant="mint" size="sm" onClick={onOpenTopUp} icon={<PlusCircle size={15} />}>
            Top Up Credits
          </ClayButton>
        </div>
      </div>

      {/* Search Input Bar */}
      <div style={{ maxWidth: '600px' }}>
        <ClayInput
          placeholder="Search teachers, topics, or skills (e.g. SQL, React, Python)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          icon={<Search size={16} />}
        />
      </div>

      {/* Live Online Classes Happening Now Section */}
      {liveSessions.length > 0 && (
        <ClayCard
          variant="raised"
          style={{
            background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
            border: '2px solid rgba(34, 197, 94, 0.4)',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 10px #22c55e' }} />
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#14532d' }}>
                Live Online Teaching Happening Now ({liveSessions.length})
              </h2>
            </div>
            <ClayBadge variant="mint">🔴 Online Now</ClayBadge>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
            {liveSessions.map(sess => (
              <div
                key={sess.id}
                style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                  border: '1px solid #bbf7d0'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <ClayBadge variant="sky">{sess.skill_name || 'General Topic'}</ClayBadge>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803d' }}>
                      IN PROGRESS
                    </span>
                  </div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.25rem' }}>
                    {sess.offer_title || 'Peer Teaching Session'}
                  </h4>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    Teacher: <strong>{sess.teacher_name}</strong>
                  </div>
                </div>

                <div style={{ marginTop: '0.85rem', paddingTop: '0.65rem', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#059669' }}>
                    {Number(sess.credit_rate || 1.0).toFixed(2)} TC / hr
                  </div>
                  <ClayButton
                    variant="mint"
                    size="sm"
                    onClick={() => handleJoinLive(sess)}
                    disabled={joiningSessionId === sess.id}
                    icon={<Video size={14} />}
                  >
                    {joiningSessionId === sess.id ? 'Joining...' : 'Join Live Class'}
                  </ClayButton>
                </div>
              </div>
            ))}
          </div>
        </ClayCard>
      )}

      {/* Offers Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {filteredOffers.map((offer) => (
          <ClayCard key={offer.id} variant="raised" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              {/* Category & Rating */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                <ClayBadge variant="lavender">{offer.category_name}</ClayBadge>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#f59e0b', fontSize: '0.85rem', fontWeight: 700 }}>
                  <Star size={15} fill="#f59e0b" />
                  <span>{offer.teacher_rating}</span>
                  <span style={{ color: '#94a3b8', fontWeight: 500 }}>({offer.review_count})</span>
                </div>
              </div>

              {/* Title & Description */}
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.3 }}>
                {offer.title}
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.875rem', lineHeight: 1.5, margin: '0.6rem 0 1rem' }}>
                {offer.description}
              </p>

              {/* Meta details chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', fontSize: '0.775rem', color: '#475569' }}>
                <span style={{ background: '#f1f5f9', padding: '0.25rem 0.55rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <User size={12} /> {offer.teacher_name}
                </span>
                <span style={{ background: '#f1f5f9', padding: '0.25rem 0.55rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Clock size={12} /> {offer.duration_minutes} mins
                </span>
                <span style={{ background: '#f1f5f9', padding: '0.25rem 0.55rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Globe size={12} /> {offer.language}
                </span>
              </div>
            </div>

            {/* Bottom Credit Price & Book Action */}
            <div style={{ marginTop: '1.25rem', paddingTop: '0.85rem', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Rate</span>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Coins size={16} color="#f59e0b" />
                  <span>{Number(offer.credit_rate || 0).toFixed(2)} TC</span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>/ hour</span>
                </div>
              </div>

              <ClayButton variant="primary" onClick={() => handleOpenBooking(offer)} icon={<Video size={14} />}>
                Request Session
              </ClayButton>
            </div>
          </ClayCard>
        ))}
      </div>

      {/* Booking Modal */}
      <ClayModal
        isOpen={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
        title={bookingSuccess ? 'Booking Request Submitted!' : `Request Session: ${selectedOffer?.title}`}
      >
        {bookingSuccess ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--pastel-mint-bg)', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <CheckCircle2 size={32} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Request Sent to {selectedOffer?.teacher_name}!</h3>
            <p style={{ color: '#475569', fontSize: '0.9rem', marginTop: '0.5rem' }}>
              Your session request has been entered into the database with status <code>Pending</code>. Once accepted by the teacher, the in-built meeting room will be scheduled!
            </p>
            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
              <ClayButton variant="primary" onClick={() => onNavigate('requests')}>
                View Service Requests
              </ClayButton>
              <ClayButton variant="secondary" onClick={() => setRequestModalOpen(false)}>
                Close
              </ClayButton>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {hasInsufficientCredits && (
              <div
                style={{
                  padding: '1rem',
                  borderRadius: '16px',
                  background: 'var(--pastel-rose-bg)',
                  border: '1px solid rgba(244, 63, 94, 0.4)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#be123c', fontWeight: 700, fontSize: '0.9rem' }}>
                  <AlertCircle size={18} />
                  <span>Insufficient TimeCredits</span>
                </div>
                <p style={{ fontSize: '0.825rem', color: '#9f1239', lineHeight: 1.4 }}>
                  You have <strong>{userBalance.toFixed(2)} TC</strong>, but this session requires <strong>{requiredCredits.toFixed(2)} TC</strong>. Top up instantly to continue.
                </p>
                <div>
                  <ClayButton variant="danger" size="sm" onClick={onOpenTopUp} icon={<CreditCard size={14} />}>
                    Top Up Credits
                  </ClayButton>
                </div>
              </div>
            )}

            <ClayInput
              label="Proposed Date & Time"
              type="datetime-local"
              value={proposedDate}
              onChange={(e) => setProposedDate(e.target.value)}
            />

            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '0.4rem' }}>
                Session Duration
              </label>
              <select
                className="clay-select"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              >
                <option value={30}>30 Minutes ({(0.5 * selectedRate).toFixed(2)} TimeCredits)</option>
                <option value={60}>60 Minutes ({(1.0 * selectedRate).toFixed(2)} TimeCredits)</option>
                <option value={90}>90 Minutes ({(1.5 * selectedRate).toFixed(2)} TimeCredits)</option>
              </select>
            </div>

            <ClayInput
              label="Message to Teacher"
              placeholder="What specific questions or topics would you like to cover?"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />

            <div style={{ padding: '0.75rem', borderRadius: '12px', background: '#f1f5f9', fontSize: '0.8rem', color: '#475569', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Available balance: <strong>{userBalance.toFixed(2)} TC</strong></span>
              <span>Cost: <strong style={{ color: '#059669' }}>{Number(requiredCredits || 0).toFixed(2)} TC</strong></span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <ClayButton variant="secondary" onClick={() => setRequestModalOpen(false)}>
                Cancel
              </ClayButton>
              <ClayButton
                variant="primary"
                onClick={handleSendRequest}
                disabled={hasInsufficientCredits}
                title={hasInsufficientCredits ? 'Please top up credits before requesting this session' : ''}
              >
                {hasInsufficientCredits ? 'Insufficient Credits' : 'Submit Request'}
              </ClayButton>
            </div>
          </div>
        )}
      </ClayModal>

      {/* Host Live Teaching Session Modal */}
      <ClayModal
        isOpen={hostModalOpen}
        onClose={() => setHostModalOpen(false)}
        title="Host & Broadcast a Live Teaching Session Online"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          <p style={{ color: '#475569', fontSize: '0.9rem', lineHeight: 1.5 }}>
            Start an instant live online class! Other members across the platform can discover your broadcast and click to join your live video classroom right away.
          </p>

          <ClayInput
            label="Session Title / Topic"
            placeholder="e.g. Advanced SQL Optimization & Indexing Workshop"
            value={hostTitle}
            onChange={(e) => setHostTitle(e.target.value)}
          />

          <ClayInput
            label="Skill / Subject Area"
            placeholder="e.g. PostgreSQL Database Systems"
            value={hostSkill}
            onChange={(e) => setHostSkill(e.target.value)}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <ClayInput
              label="Session Duration (Minutes)"
              type="number"
              value={hostDuration}
              onChange={(e) => setHostDuration(Number(e.target.value))}
            />
            <ClayInput
              label="Credit Rate (TC / hr)"
              type="number"
              step="0.25"
              value={hostRate}
              onChange={(e) => setHostRate(Number(e.target.value))}
            />
          </div>

          <ClayInput
            label="Short Description / Agenda"
            placeholder="What will you teach? Any prerequisites for the student?"
            value={hostDesc}
            onChange={(e) => setHostDesc(e.target.value)}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <ClayButton variant="secondary" onClick={() => setHostModalOpen(false)}>
              Cancel
            </ClayButton>
            <ClayButton
              variant="primary"
              onClick={handleStartHostSession}
              disabled={isHosting}
              icon={<Sparkles size={16} />}
            >
              {isHosting ? 'Broadcasting...' : 'Start Live Class Now'}
            </ClayButton>
          </div>
        </div>
      </ClayModal>
    </div>
  );
};
