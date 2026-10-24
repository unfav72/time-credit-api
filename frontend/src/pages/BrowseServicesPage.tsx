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
  CreditCard
} from 'lucide-react';
import { ClayCard } from '../components/clay/ClayCard';
import { ClayButton } from '../components/clay/ClayButton';
import { ClayBadge } from '../components/clay/ClayBadge';
import { ClayModal } from '../components/clay/ClayModal';
import { ClayInput } from '../components/clay/ClayInput';
import { api } from '../services/api';
import type { ServiceOffer, User as UserType } from '../types';

interface BrowseServicesPageProps {
  currentUser: UserType;
  onNavigate: (page: string) => void;
  onOpenTopUp: () => void;
}

export const BrowseServicesPage: React.FC<BrowseServicesPageProps> = ({ currentUser, onNavigate, onOpenTopUp }) => {
  const [offers, setOffers] = useState<ServiceOffer[]>([]);
  const [selectedOffer, setSelectedOffer] = useState<ServiceOffer | null>(null);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [proposedDate, setProposedDate] = useState('2026-10-25T15:00');
  const [duration, setDuration] = useState(60);
  const [message, setMessage] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadOffers();
  }, []);

  const loadOffers = async () => {
    const list = await api.getOffers();
    setOffers(list);
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
            Book 1-on-1 video sessions with expert members. 1 TimeCredit = 15 minutes of learning.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', width: '100%', maxWidth: '480px' }}>
          <div style={{ flex: 1 }}>
            <ClayInput
              placeholder="Search teachers or topics..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search size={16} />}
            />
          </div>
          <ClayButton variant="mint" size="sm" onClick={onOpenTopUp} icon={<PlusCircle size={15} />}>
            Top Up Credits
          </ClayButton>
        </div>
      </div>

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
              Your session request has been entered into the MySQL database with status <code>Pending</code>. Once accepted by the teacher, the in-built meeting room will be scheduled!
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
            {/* Insufficient Credits Warning Alert */}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#9f1239', fontWeight: 800, fontSize: '0.9rem' }}>
                  <AlertCircle size={18} />
                  <span>Insufficient TimeCredits for this Session</span>
                </div>
                <p style={{ color: '#be123c', fontSize: '0.825rem', margin: 0, lineHeight: 1.4 }}>
                  This {duration}-minute session requires <strong>{Number(requiredCredits || 0).toFixed(2)} TimeCredits</strong>, but your available balance is <strong>{userBalance.toFixed(2)} TC</strong>. Top up your TimeCredits to continue.
                </p>
                <div style={{ alignSelf: 'flex-start', marginTop: '0.25rem' }}>
                  <ClayButton
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      setRequestModalOpen(false);
                      onOpenTopUp();
                    }}
                    icon={<CreditCard size={14} />}
                  >
                    Top Up TimeCredits with Razorpay
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
    </div>
  );
};
