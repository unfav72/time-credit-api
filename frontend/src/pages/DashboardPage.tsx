import React, { useState, useEffect } from 'react';
import {
  Coins,
  BookOpen,
  CalendarCheck,
  Inbox,
  Video,
  Database,
  ArrowUpRight,
  Clock,
  Sparkles,
  TrendingUp,
  Award,
  Layers,
  ChevronRight,
  AlertCircle,
  CreditCard,
  PlusCircle
} from 'lucide-react';
import { ClayCard } from '../components/clay/ClayCard';
import { ClayButton } from '../components/clay/ClayButton';
import { ClayBadge } from '../components/clay/ClayBadge';
import { ClayStatCard } from '../components/clay/ClayStatCard';
import { api } from '../services/api';
import type { User, Session, ServiceRequest, ServiceOffer } from '../types';

interface DashboardPageProps {
  currentUser: User;
  onNavigate: (page: string) => void;
  onOpenTopUp: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ currentUser, onNavigate, onOpenTopUp }) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [offers, setOffers] = useState<ServiceOffer[]>([]);

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const loadData = async () => {
    try {
      const [sess, reqs, offs] = await Promise.all([
        api.getSessions(),
        api.getRequests(),
        api.getOffers()
      ]);
      setSessions(sess);
      setRequests(reqs);
      setOffers(offs);
    } catch (e) {
      console.error(e);
    }
  };

  const upcomingSession = sessions.find(s => s.status === 'SCHEDULED' || s.status === 'IN_PROGRESS');
  const pendingRequests = requests.filter(r => r.status === 'Pending');
  const userBalance = Number(currentUser?.balance || 0);
  const isLowBalance = userBalance < 1.0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Low-Balance Alert Banner */}
      {isLowBalance && (
        <ClayCard
          variant="raised"
          style={{
            background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
            border: '2px solid rgba(239, 68, 68, 0.4)',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertCircle size={24} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#991b1b' }}>
                Low TimeCredit Balance Alert
              </div>
              <div style={{ fontSize: '0.825rem', color: '#b91c1c' }}>
                You have only <strong>{userBalance.toFixed(2)} TC</strong> remaining. Top up your TimeCredits to book live peer-learning classes without interruption.
              </div>
            </div>
          </div>

          <ClayButton variant="primary" size="sm" onClick={onOpenTopUp} icon={<PlusCircle size={15} />}>
            Top Up TimeCredits
          </ClayButton>
        </ClayCard>
      )}

      {/* Welcome Banner */}
      <ClayCard
        variant="raised"
        style={{
          background: 'linear-gradient(135deg, #ede9fe 0%, #e0f2fe 100%)',
          border: '2px solid rgba(255, 255, 255, 0.9)',
          padding: '1.75rem 2rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1.5rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
            <ClayBadge variant="lavender">Active Member</ClayBadge>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>• MySQL 8+ Relational Session Active</span>
          </div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            Welcome back, {currentUser.full_name}! 👋
          </h1>
          <p style={{ color: '#475569', fontSize: '0.95rem', marginTop: '0.25rem' }}>
            You have <strong>{userBalance.toFixed(2)} TimeCredits</strong> ready to exchange for live 1-on-1 peer teaching.
          </p>
        </div>

        {/* Quick Actions Cluster */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
          <ClayButton variant="mint" onClick={onOpenTopUp} icon={<CreditCard size={16} />}>
            Top Up TimeCredits
          </ClayButton>
          <ClayButton variant="primary" onClick={() => onNavigate('classroom')} icon={<Video size={16} />}>
            Join Live Class
          </ClayButton>
          <ClayButton variant="secondary" onClick={() => onNavigate('browse')} icon={<BookOpen size={16} />}>
            Browse Skills
          </ClayButton>
        </div>
      </ClayCard>

      {/* Primary Live MySQL Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
        <ClayStatCard
          title="Available TimeCredits"
          value={`${userBalance.toFixed(2)} TC`}
          subtitle="1 TC = 15 minutes of live learning"
          icon={<Coins size={22} color="#f59e0b" />}
          iconBg="#fef3c7"
          badge="Live Balance"
          badgeVariant="amber"
          onClick={() => onNavigate('wallet')}
        />

        <ClayStatCard
          title="Skills Offered & Wanted"
          value={`${currentUser.skills_offered_count || 3} Offered / ${currentUser.skills_wanted_count || 2} Wanted`}
          subtitle="Matched via relational joins"
          icon={<BookOpen size={22} color="#6366f1" />}
          iconBg="#ede9fe"
          badge="Relational"
          badgeVariant="lavender"
          onClick={() => onNavigate('skills')}
        />

        <ClayStatCard
          title="Upcoming Sessions"
          value={sessions.filter(s => s.status === 'SCHEDULED').length}
          subtitle="Scheduled live video classes"
          icon={<CalendarCheck size={22} color="#059669" />}
          iconBg="#d1fae5"
          badge="In-Built WebRTC"
          badgeVariant="mint"
          onClick={() => onNavigate('sessions')}
        />

        <ClayStatCard
          title="Pending Requests"
          value={pendingRequests.length}
          subtitle="Waiting for teacher confirmation"
          icon={<Inbox size={22} color="#0284c7" />}
          iconBg="#e0f2fe"
          badge="Requests"
          badgeVariant="sky"
          onClick={() => onNavigate('requests')}
        />
      </div>

      {/* Main Two-Column Activity Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
        
        {/* Next Live Classroom Session */}
        <ClayCard variant="raised" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Video size={18} color="#6366f1" />
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Next Scheduled Session</h2>
            </div>
            <ClayBadge variant="mint">In-Built Meeting</ClayBadge>
          </div>

          {upcomingSession ? (
            <div style={{ padding: '1.25rem', borderRadius: '18px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6366f1', textTransform: 'uppercase' }}>
                  {upcomingSession.skill_name || 'Database Management'}
                </span>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.15rem' }}>
                  {upcomingSession.offer_title}
                </h3>
              </div>

              <div style={{ fontSize: '0.85rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <div>👨‍🏫 Instructor: <strong>{upcomingSession.teacher_name}</strong></div>
                <div>👨‍🎓 Learner: <strong>{upcomingSession.learner_name}</strong></div>
                <div>⏱ Duration: <strong>{upcomingSession.eligible_duration_minutes || 60} mins ({upcomingSession.credit_rate || 1.0} TC)</strong></div>
                <div>🔑 Meeting Room: <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', background: '#edf2f7', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>{upcomingSession.meeting_room_id}</code></div>
              </div>

              <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                <ClayButton variant="mint" onClick={() => onNavigate('classroom')} icon={<Video size={15} />}>
                  Enter Live Classroom
                </ClayButton>
                <ClayButton variant="secondary" onClick={() => onNavigate('sessions')}>
                  View Details
                </ClayButton>
              </div>
            </div>
          ) : (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
              <CalendarCheck size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
              <div>No upcoming sessions scheduled.</div>
              <div style={{ marginTop: '0.75rem' }}>
                <ClayButton size="sm" variant="primary" onClick={() => onNavigate('browse')}>
                  Browse Teachers
                </ClayButton>
              </div>
            </div>
          )}
        </ClayCard>

        {/* Recommended Skills & Packages Spotlight */}
        <ClayCard variant="raised" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={18} color="#f59e0b" />
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Featured Knowledge Offers</h2>
            </div>
            <button
              onClick={() => onNavigate('browse')}
              style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              View All <ChevronRight size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {offers.slice(0, 3).map((offer) => (
              <div
                key={offer.id}
                onClick={() => onNavigate('browse')}
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '16px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'transform 0.2s ease',
                }}
                className="hover-card"
              >
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>
                    {offer.category_name}
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.1rem' }}>
                    {offer.title}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
                    by {offer.teacher_name} • ⭐ {offer.teacher_rating} ({offer.review_count} reviews)
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <ClayBadge variant="amber">
                    {offer.credit_rate} TC / hr
                  </ClayBadge>
                </div>
              </div>
            ))}
          </div>
        </ClayCard>
      </div>

      {/* SQL & DBMS Architecture Highlights */}
      <ClayCard
        variant="inset"
        style={{
          padding: '1.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          background: 'var(--pastel-blue-bg)',
          border: '1px solid rgba(186, 230, 253, 0.9)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7', boxShadow: '2px 2px 6px rgba(166, 180, 200, 0.3)' }}>
            <Layers size={22} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0369a1' }}>
              Database Architecture: 3NF Relational Model & Double-Entry Ledger
            </div>
            <div style={{ fontSize: '0.8rem', color: '#0284c7' }}>
              17 normalized tables, referential integrity cascades, atomic transactions with row locking, and real query execution.
            </div>
          </div>
        </div>

        <ClayButton size="sm" variant="primary" onClick={() => onNavigate('reports')}>
          View DBMS Analytics & Audit
        </ClayButton>
      </ClayCard>
    </div>
  );
};
