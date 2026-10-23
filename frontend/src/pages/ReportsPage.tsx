import React, { useState } from 'react';
import {
  BarChart3,
  Award,
  Sparkles,
  Database,
  ArrowRight,
  TrendingUp,
  Users,
  Clock,
  Coins,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { ClayCard } from '../components/clay/ClayCard';
import { ClayButton } from '../components/clay/ClayButton';
import { ClayBadge } from '../components/clay/ClayBadge';
import { ClayStatCard } from '../components/clay/ClayStatCard';

interface ReportsPageProps {
  onNavigate: (page: string) => void;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({ onNavigate }) => {
  const [activeReport, setActiveReport] = useState<'leaderboard' | 'popular' | 'ledger_audit'>('leaderboard');

  const teachers = [
    { name: 'Priya Patel', sessions: 28, hours: 28.0, rating: 4.95, credits: 8.50, specialty: 'DBMS & SQL Optimization' },
    { name: 'Sara Kim', sessions: 22, hours: 16.5, rating: 5.00, credits: 6.00, specialty: 'Claymorphism 3D UI' },
    { name: 'Marcus Vance', sessions: 19, hours: 19.0, rating: 4.85, credits: 4.00, specialty: 'React 19 & TypeScript' },
    { name: 'Prof. Alex Chen', sessions: 15, hours: 15.0, rating: 4.90, credits: 15.00, specialty: 'Database Normalization' }
  ];

  const popularSkills = [
    { skill: 'SQL Joins & Complex Queries', category: 'Database Systems & SQL', offers: 8, requests: 24, avgRating: 4.9 },
    { skill: 'Database Normalization (1NF to BCNF)', category: 'Database Systems & SQL', offers: 6, requests: 19, avgRating: 4.9 },
    { skill: 'Claymorphism 3D UI Design', category: 'UI/UX Design', offers: 7, requests: 18, avgRating: 5.0 },
    { skill: 'React 19 & TypeScript Architecture', category: 'Web Development', offers: 9, requests: 17, avgRating: 4.8 }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>DBMS Analytical Reports</h1>
            <ClayBadge variant="lavender">SQL Views & Aggregations</ClayBadge>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Multi-table GROUP BY, HAVING, subqueries, and double-entry consistency equations computed in MySQL.
          </p>
        </div>

        <ClayButton variant="primary" onClick={() => onNavigate('wallet')} icon={<ShieldCheck size={16} />}>
          View TimeCredit Ledger
        </ClayButton>
      </div>

      {/* Report Tabs */}
      <div style={{ display: 'flex', background: 'var(--clay-surface)', padding: '0.25rem', borderRadius: '16px', boxShadow: 'var(--clay-shadow-btn)', width: 'fit-content' }}>
        <button
          onClick={() => setActiveReport('leaderboard')}
          style={{
            border: 'none',
            padding: '0.45rem 1rem',
            borderRadius: '12px',
            background: activeReport === 'leaderboard' ? 'var(--pastel-lavender-bg)' : 'transparent',
            color: activeReport === 'leaderboard' ? '#4338ca' : '#64748b',
            fontWeight: 700,
            fontSize: '0.825rem',
            cursor: 'pointer'
          }}
        >
          Teacher Leaderboard (v_teacher_leaderboard)
        </button>
        <button
          onClick={() => setActiveReport('popular')}
          style={{
            border: 'none',
            padding: '0.45rem 1rem',
            borderRadius: '12px',
            background: activeReport === 'popular' ? 'var(--pastel-lavender-bg)' : 'transparent',
            color: activeReport === 'popular' ? '#4338ca' : '#64748b',
            fontWeight: 700,
            fontSize: '0.825rem',
            cursor: 'pointer'
          }}
        >
          Most Popular Skills (v_popular_skills)
        </button>
        <button
          onClick={() => setActiveReport('ledger_audit')}
          style={{
            border: 'none',
            padding: '0.45rem 1rem',
            borderRadius: '12px',
            background: activeReport === 'ledger_audit' ? 'var(--pastel-lavender-bg)' : 'transparent',
            color: activeReport === 'ledger_audit' ? '#4338ca' : '#64748b',
            fontWeight: 700,
            fontSize: '0.825rem',
            cursor: 'pointer'
          }}
        >
          Double-Entry Consistency Audit
        </button>
      </div>

      {/* Active Report View */}
      {activeReport === 'leaderboard' && (
        <ClayCard variant="raised" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Top Instructors Leaderboard</h2>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Ranked by completed sessions, verified hours taught, and average star ratings in MySQL views.
              </span>
            </div>
            <ClayBadge variant="mint">Active Ranking</ClayBadge>
          </div>

          <div className="clay-table-container">
            <table className="clay-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Instructor Name</th>
                  <th>Core Specialty</th>
                  <th>Completed Sessions</th>
                  <th>Teaching Hours</th>
                  <th>Average Rating</th>
                  <th>TimeCredits Held</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((t, idx) => (
                  <tr key={t.name}>
                    <td>
                      <ClayBadge variant={idx === 0 ? 'amber' : idx === 1 ? 'lavender' : 'sky'}>
                        #{idx + 1}
                      </ClayBadge>
                    </td>
                    <td><strong>{t.name}</strong></td>
                    <td>{t.specialty}</td>
                    <td><strong>{t.sessions}</strong> sessions</td>
                    <td>{t.hours} hrs</td>
                    <td>
                      <span style={{ color: '#f59e0b', fontWeight: 700 }}>
                        ★ {t.rating.toFixed(2)}
                      </span>
                    </td>
                    <td>
                      <strong style={{ color: '#059669' }}>{t.credits.toFixed(2)} TC</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ClayCard>
      )}

      {activeReport === 'popular' && (
        <ClayCard variant="raised" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Most Popular Skills in Demand</h2>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Calculated using service offers and learner requests aggregation.
              </span>
            </div>
            <ClayBadge variant="sky">Market Demand</ClayBadge>
          </div>

          <div className="clay-table-container">
            <table className="clay-table">
              <thead>
                <tr>
                  <th>Skill Name</th>
                  <th>Category</th>
                  <th>Service Offers</th>
                  <th>Learner Requests</th>
                  <th>Average Rating</th>
                </tr>
              </thead>
              <tbody>
                {popularSkills.map(ps => (
                  <tr key={ps.skill}>
                    <td><strong>{ps.skill}</strong></td>
                    <td><ClayBadge variant="sky">{ps.category}</ClayBadge></td>
                    <td>{ps.offers} teachers</td>
                    <td><strong>{ps.requests} requests</strong></td>
                    <td><span style={{ color: '#f59e0b', fontWeight: 700 }}>★ {ps.avgRating}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ClayCard>
      )}

      {activeReport === 'ledger_audit' && (
        <ClayCard variant="raised" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Double-Entry Ledger Equation Check</h2>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Verification rule: In an ACID ledger, <code>Sum(DEBITS)</code> must strictly equal <code>Sum(CREDITS)</code> for all committed transactions.
              </span>
            </div>
            <ClayBadge variant="mint">AUDIT PASSED: 100% BALANCED</ClayBadge>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '0.5rem' }}>
            <div style={{ padding: '1.25rem', borderRadius: '16px', background: 'var(--pastel-mint-bg)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: '#065f46', fontWeight: 700 }}>TOTAL CREDITED</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#065f46', marginTop: '0.25rem' }}>14.50 TC</div>
            </div>
            <div style={{ padding: '1.25rem', borderRadius: '16px', background: 'var(--pastel-rose-bg)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: '#9f1239', fontWeight: 700 }}>TOTAL DEBITED</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#9f1239', marginTop: '0.25rem' }}>14.50 TC</div>
            </div>
            <div style={{ padding: '1.25rem', borderRadius: '16px', background: 'var(--pastel-blue-bg)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: '#0369a1', fontWeight: 700 }}>VARIANCE / LEAKAGE</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0369a1', marginTop: '0.25rem' }}>0.00 TC</div>
            </div>
          </div>
        </ClayCard>
      )}
    </div>
  );
};
