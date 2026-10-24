import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Users,
  Layers,
  HeartHandshake,
  Target,
  Trash2,
  MessageSquare,
  GraduationCap,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { ClayCard } from '../components/clay/ClayCard';
import { ClayButton } from '../components/clay/ClayButton';
import { ClayBadge } from '../components/clay/ClayBadge';
import { ClayModal } from '../components/clay/ClayModal';
import { ClayInput } from '../components/clay/ClayInput';
import { api } from '../services/api';
import type { Skill, SkillCategory } from '../types';

interface SkillsPageProps {
  onNavigate: (page: string) => void;
}

export const SkillsPage: React.FC<SkillsPageProps> = ({ onNavigate }) => {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'catalog' | 'wanted'>('catalog');

  // User Skills & DB Matches
  const [userSkills, setUserSkills] = useState<{ offered: any[]; wanted: any[] }>({ offered: [], wanted: [] });
  const [matches, setMatches] = useState<any[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);

  // Register New Skill in Catalog Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillCat, setNewSkillCat] = useState<number>(1);
  const [newSkillDesc, setNewSkillDesc] = useState('');

  // Add Wanted Skill Modal
  const [wantedModalOpen, setWantedModalOpen] = useState(false);
  const [wantedSkillId, setWantedSkillId] = useState<number>(0);
  const [wantedExpLevel, setWantedExpLevel] = useState('beginner');

  // Feedback Toast
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [sk, cat, uSkills, matchData] = await Promise.all([
        api.getSkills().catch(() => []),
        api.getCategories().catch(() => []),
        api.getUserSkills().catch(() => ({ offered: [], wanted: [] })),
        api.getSkillMatches().catch(() => [])
      ]);
      setSkills(sk);
      setCategories(cat);
      setUserSkills(uSkills);
      setMatches(matchData);
      if (sk.length > 0 && wantedSkillId === 0) {
        setWantedSkillId(sk[0].id);
      }
    } catch (err) {
      console.warn('Failed loading skills data:', err);
    }
  };

  const handleCreateSkill = async () => {
    if (!newSkillName.trim()) return;
    try {
      await api.createSkill(newSkillName.trim(), newSkillCat, newSkillDesc.trim());
      await loadData();
      setCreateModalOpen(false);
      setNewSkillName('');
      setNewSkillDesc('');
      showToast('Skill successfully registered in catalog!');
    } catch (err: any) {
      showToast('Failed creating skill in database: ' + (err?.message || 'Error'), 'error');
    }
  };

  const handleAddWantedSkill = async () => {
    if (!wantedSkillId) {
      alert('Please select a skill.');
      return;
    }
    try {
      await api.addUserSkill(wantedSkillId, 'WANT', wantedExpLevel);
      await loadData();
      setWantedModalOpen(false);
      showToast('Wanted skill added! Database relational matching updated.');
    } catch (err: any) {
      showToast('Failed adding wanted skill: ' + (err?.message || 'Error'), 'error');
    }
  };

  const handleQuickAddWanted = async (skillId: number, skillName: string) => {
    try {
      await api.addUserSkill(skillId, 'WANT', 'intermediate');
      await loadData();
      showToast(`Added "${skillName}" to your Wanted Skills!`);
    } catch (err: any) {
      showToast('Error adding wanted skill: ' + (err?.message || 'Error'), 'error');
    }
  };

  const handleQuickAddOffered = async (skillId: number, skillName: string) => {
    try {
      await api.addUserSkill(skillId, 'OFFER', 'advanced');
      await loadData();
      showToast(`Added "${skillName}" to your Offered Skills!`);
    } catch (err: any) {
      showToast('Error offering skill: ' + (err?.message || 'Error'), 'error');
    }
  };

  const handleRemoveSkill = async (id: number, skillName: string) => {
    try {
      await api.removeUserSkill(id);
      await loadData();
      showToast(`Removed "${skillName}" from your skill profile.`);
    } catch (err: any) {
      showToast('Failed removing skill: ' + (err?.message || 'Error'), 'error');
    }
  };

  const filteredSkills = skills.filter(s => {
    const matchesCat = selectedCategory ? s.category_id === selectedCategory : true;
    const matchesSearch = (s.name || '').toLowerCase().includes(search.toLowerCase()) || 
                          (s.description || '').toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Toast Notification Banner */}
      {feedbackMsg && (
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderRadius: '16px',
            background: feedbackMsg.type === 'success' ? '#f0fdf4' : '#fef2f2',
            border: feedbackMsg.type === 'success' ? '1px solid #86efac' : '1px solid #fca5a5',
            color: feedbackMsg.type === 'success' ? '#166534' : '#991b1b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
            fontSize: '0.875rem',
            fontWeight: 600
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {feedbackMsg.type === 'success' ? <CheckCircle2 size={18} color="#16a34a" /> : <AlertCircle size={18} color="#dc2626" />}
            <span>{feedbackMsg.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMsg(null)}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 800, color: 'inherit' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Skill Catalog & Relational Match Engine</h1>
            <ClayBadge variant="lavender">PostgreSQL 3NF</ClayBadge>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Post your required skills and instantly match them with instructors offering them from the database.
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
          <ClayButton variant="mint" onClick={() => setWantedModalOpen(true)} icon={<Target size={16} />}>
            + Add Wanted Skill
          </ClayButton>
          <ClayButton variant="primary" onClick={() => setCreateModalOpen(true)} icon={<Plus size={16} />}>
            Register New Skill
          </ClayButton>
        </div>
      </div>

      {/* Primary Section Switcher Tabs */}
      <div style={{ display: 'flex', background: '#f1f5f9', padding: '0.35rem', borderRadius: '16px', gap: '0.35rem', maxWidth: '620px' }}>
        <button
          onClick={() => setActiveTab('catalog')}
          style={{
            flex: 1,
            border: 'none',
            padding: '0.65rem 1rem',
            borderRadius: '12px',
            background: activeTab === 'catalog' ? '#ffffff' : 'transparent',
            fontWeight: 800,
            fontSize: '0.85rem',
            color: activeTab === 'catalog' ? '#4338ca' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            boxShadow: activeTab === 'catalog' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
            transition: 'all 0.15s ease'
          }}
        >
          <BookOpen size={16} />
          <span>Browse Catalog ({skills.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('wanted')}
          style={{
            flex: 1,
            border: 'none',
            padding: '0.65rem 1rem',
            borderRadius: '12px',
            background: activeTab === 'wanted' ? '#ffffff' : 'transparent',
            fontWeight: 800,
            fontSize: '0.85rem',
            color: activeTab === 'wanted' ? '#059669' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            boxShadow: activeTab === 'wanted' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
            transition: 'all 0.15s ease'
          }}
        >
          <HeartHandshake size={16} />
          <span>Skills Wanted & Matches</span>
          {matches.length > 0 && (
            <span style={{ background: '#22c55e', color: '#fff', fontSize: '0.68rem', fontWeight: 800, padding: '2px 7px', borderRadius: '999px' }}>
              {matches.length} Matched
            </span>
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: SKILLS WANTED & RELATIONAL MATCHES FROM DATABASE                    */}
      {/* ========================================================================= */}
      {activeTab === 'wanted' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Section A: My Wanted Skills */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Target size={20} color="#059669" />
                  <span>My Required Skills (Wanted)</span>
                </h2>
                <p style={{ fontSize: '0.825rem', color: '#64748b', marginTop: '2px' }}>
                  These are the skills you currently need. Antigravity connects to Neon DB to match members offering them.
                </p>
              </div>

              <ClayButton size="sm" variant="mint" onClick={() => setWantedModalOpen(true)} icon={<Plus size={14} />}>
                + Add Wanted Skill
              </ClayButton>
            </div>

            {userSkills.wanted.length === 0 ? (
              <ClayCard variant="raised" style={{ padding: '2.5rem', textAlign: 'center', background: '#f8fafc' }}>
                <Target size={36} color="#94a3b8" style={{ margin: '0 auto 0.75rem' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#334155' }}>No Wanted Skills Added Yet</h3>
                <p style={{ color: '#64748b', fontSize: '0.85rem', maxWidth: '420px', margin: '0.4rem auto 1rem' }}>
                  Tell the platform what you want to learn! Other users offering those topics in PostgreSQL will automatically be matched with you.
                </p>
                <ClayButton variant="mint" onClick={() => setWantedModalOpen(true)} icon={<Plus size={14} />}>
                  Add Your First Required Skill
                </ClayButton>
              </ClayCard>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                {userSkills.wanted.map((item: any) => (
                  <ClayCard
                    key={item.id}
                    variant="raised"
                    style={{
                      padding: '1.15rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      borderRadius: '18px',
                      background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)',
                      border: '1.5px solid rgba(34, 197, 94, 0.25)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                        <ClayBadge variant="mint">WANTED SKILL</ClayBadge>
                        <ClayBadge variant="lavender" style={{ textTransform: 'capitalize' }}>
                          {item.experience_level || 'all levels'}
                        </ClayBadge>
                      </div>

                      <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginTop: '0.35rem' }}>
                        {item.skill_name}
                      </h3>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>
                        Category: <strong>{item.category_name}</strong>
                      </div>
                      {item.description && (
                        <p style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.45rem', lineHeight: 1.4 }}>
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem', paddingTop: '0.65rem', borderTop: '1px dashed #cbd5e1' }}>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        Added {new Date(item.created_at).toLocaleDateString()}
                      </span>
                      <button
                        onClick={() => handleRemoveSkill(item.id, item.skill_name)}
                        style={{
                          background: '#fee2e2',
                          border: 'none',
                          color: '#dc2626',
                          borderRadius: '8px',
                          padding: '0.3rem 0.65rem',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        title="Remove this wanted skill"
                      >
                        <Trash2 size={12} /> Remove
                      </button>
                    </div>
                  </ClayCard>
                ))}
              </div>
            )}
          </div>

          {/* Section B: Database Relational Matches */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Sparkles size={20} color="#6366f1" />
                    <span>Database Relational Matches ({matches.length})</span>
                  </h2>
                  <ClayBadge variant="lavender">Real-Time Self Join</ClayBadge>
                </div>
                <p style={{ fontSize: '0.825rem', color: '#64748b', marginTop: '2px' }}>
                  Members from Neon PostgreSQL who offer the exact skills you want to learn!
                </p>
              </div>

              <ClayButton size="sm" variant="secondary" onClick={loadData}>
                🔄 Refresh Matches
              </ClayButton>
            </div>

            {matches.length === 0 ? (
              <ClayCard variant="raised" style={{ padding: '2.5rem', textAlign: 'center', background: '#f8fafc' }}>
                <HeartHandshake size={38} color="#94a3b8" style={{ margin: '0 auto 0.75rem' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#334155' }}>No Instructor Matches Yet</h3>
                <p style={{ color: '#64748b', fontSize: '0.85rem', maxWidth: '460px', margin: '0.4rem auto 1rem' }}>
                  We are monitoring the database! As soon as another registered member marks an OFFER or creates a course for your wanted skills, they will immediately be matched and displayed here.
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
                  <ClayButton variant="secondary" onClick={() => onNavigate('browse')}>
                    Browse All Active Courses
                  </ClayButton>
                  <ClayButton variant="mint" onClick={() => setWantedModalOpen(true)}>
                    Add More Wanted Skills
                  </ClayButton>
                </div>
              </ClayCard>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
                {matches.map((match: any, idx: number) => (
                  <ClayCard
                    key={`${match.teacher_id}_${match.skill_id || idx}`}
                    variant="raised"
                    style={{
                      padding: '1.35rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      borderRadius: '20px',
                      background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                      border: '2px solid rgba(99, 102, 241, 0.25)',
                      boxShadow: '0 8px 24px rgba(99, 102, 241, 0.08)'
                    }}
                  >
                    <div>
                      {/* Top Header: Skill & Category */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                        <ClayBadge variant="lavender">
                          🎯 Matched: {match.skill_name}
                        </ClayBadge>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669' }}>
                          {Number(match.credit_rate || 1.0).toFixed(2)} TC / hr
                        </span>
                      </div>

                      {/* Instructor Information */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.75rem 0' }}>
                        <div
                          style={{
                            width: '46px',
                            height: '46px',
                            borderRadius: '14px',
                            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '1.15rem',
                            flexShrink: 0
                          }}
                        >
                          {match.teacher_name?.charAt(0) || 'T'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {match.teacher_name}
                          </h4>
                          <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {match.teacher_email}
                          </p>
                        </div>
                      </div>

                      {/* Course / Teaching Topic */}
                      <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '0.5rem' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6366f1', textTransform: 'uppercase' }}>
                          Course / Teaching Topic
                        </div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', marginTop: '2px' }}>
                          {match.offer_title || `${match.skill_name} Peer Mentorship`}
                        </div>
                        {match.teacher_bio && (
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', fontStyle: 'italic' }}>
                            "{match.teacher_bio}"
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginTop: '1.15rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
                      <ClayButton
                        size="sm"
                        variant="secondary"
                        onClick={() => onNavigate('chat')}
                        icon={<MessageSquare size={14} />}
                        style={{ width: '100%', justifyContent: 'center' }}
                      >
                        Chat Tutor
                      </ClayButton>
                      <ClayButton
                        size="sm"
                        variant="primary"
                        onClick={() => onNavigate('browse')}
                        icon={<Calendar size={14} />}
                        style={{ width: '100%', justifyContent: 'center' }}
                      >
                        Book Class
                      </ClayButton>
                    </div>
                  </ClayCard>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: GENERAL SKILLS CATALOG                                             */}
      {/* ========================================================================= */}
      {activeTab === 'catalog' && (
        <>
          {/* Categories Filter Carousel */}
          <div style={{ display: 'flex', gap: '0.6rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
            <button
              onClick={() => setSelectedCategory(null)}
              className="clay-button"
              style={{
                background: selectedCategory === null ? 'var(--pastel-lavender-bg)' : '#ffffff',
                color: selectedCategory === null ? '#4338ca' : '#475569',
                fontSize: '0.8rem',
                padding: '0.45rem 1rem',
                borderRadius: '14px',
                whiteSpace: 'nowrap'
              }}
            >
              All Categories ({skills.length})
            </button>
            {categories.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className="clay-button"
                style={{
                  background: selectedCategory === c.id ? 'var(--pastel-lavender-bg)' : '#ffffff',
                  color: selectedCategory === c.id ? '#4338ca' : '#475569',
                  fontSize: '0.8rem',
                  padding: '0.45rem 1rem',
                  borderRadius: '14px',
                  whiteSpace: 'nowrap'
                }}
              >
                {c.name}
              </button>
            ))}
          </div>

          {/* Search Input Bar */}
          <div style={{ maxWidth: '480px' }}>
            <ClayInput
              placeholder="Search skills (e.g. Normalization, React, SQL Joins, Photoshop...)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search size={16} />}
            />
          </div>

          {/* Skills Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '1.25rem' }}>
            {filteredSkills.map(skill => {
              const isWanted = userSkills.wanted.some(w => w.skill_id === skill.id || w.skill_name === skill.name);
              const isOffered = userSkills.offered.some(o => o.skill_id === skill.id || o.skill_name === skill.name);

              return (
                <ClayCard key={skill.id} variant="raised" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <ClayBadge variant="sky">
                        {skill.category_name}
                      </ClayBadge>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                        {skill.offer_count} Offered • {skill.want_count} Wanted
                      </div>
                    </div>

                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.25rem' }}>
                      {skill.name}
                    </h3>
                    <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.5, marginTop: '0.4rem' }}>
                      {skill.description || 'Database backed peer-learning subject area.'}
                    </p>

                    {/* Status Tags */}
                    <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.65rem' }}>
                      {isWanted && <ClayBadge variant="mint">In My Wanted List</ClayBadge>}
                      {isOffered && <ClayBadge variant="lavender">I Can Teach This</ClayBadge>}
                    </div>
                  </div>

                  {/* Actions to express Want vs Offer */}
                  <div style={{ marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => handleQuickAddWanted(skill.id, skill.name)}
                        style={{
                          flex: 1,
                          padding: '0.45rem 0.65rem',
                          borderRadius: '10px',
                          border: '1px solid #86efac',
                          background: isWanted ? '#dcfce7' : '#f0fdf4',
                          color: '#15803d',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}
                      >
                        <Target size={13} />
                        <span>{isWanted ? '✓ Wanted' : '+ Want to Learn'}</span>
                      </button>

                      <button
                        onClick={() => handleQuickAddOffered(skill.id, skill.name)}
                        style={{
                          flex: 1,
                          padding: '0.45rem 0.65rem',
                          borderRadius: '10px',
                          border: '1px solid #c7d2fe',
                          background: isOffered ? '#e0e7ff' : '#eef2ff',
                          color: '#4338ca',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}
                      >
                        <GraduationCap size={13} />
                        <span>{isOffered ? '✓ Offering' : '+ Can Teach'}</span>
                      </button>
                    </div>

                    <ClayButton size="sm" variant="secondary" onClick={() => onNavigate('browse')} style={{ width: '100%' }}>
                      Find Live Courses & Tutors
                    </ClayButton>
                  </div>
                </ClayCard>
              );
            })}
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ADD WANTED SKILL                                                 */}
      {/* ========================================================================= */}
      <ClayModal
        isOpen={wantedModalOpen}
        onClose={() => setWantedModalOpen(false)}
        title="Add a Required Skill (Skills Wanted)"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          <p style={{ color: '#475569', fontSize: '0.9rem', lineHeight: 1.5 }}>
            Specify a skill you want to learn. Antigravity will automatically search PostgreSQL for instructors offering this skill and notify you of matches!
          </p>

          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '0.4rem' }}>
              Select Skill from Catalog
            </label>
            <select
              className="clay-select"
              value={wantedSkillId}
              onChange={(e) => setWantedSkillId(Number(e.target.value))}
            >
              {skills.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.category_name})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '0.4rem' }}>
              Target Proficiency Level
            </label>
            <select
              className="clay-select"
              value={wantedExpLevel}
              onChange={(e) => setWantedExpLevel(e.target.value)}
            >
              <option value="beginner">Beginner (Foundations & Basics)</option>
              <option value="intermediate">Intermediate (Practical Application)</option>
              <option value="advanced">Advanced (Deep Dive & Optimization)</option>
              <option value="expert">Expert (Architecture & Problem Solving)</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <ClayButton variant="secondary" onClick={() => setWantedModalOpen(false)}>
              Cancel
            </ClayButton>
            <ClayButton variant="mint" onClick={handleAddWantedSkill} icon={<Target size={15} />}>
              Add to Wanted Skills
            </ClayButton>
          </div>
        </div>
      </ClayModal>

      {/* ========================================================================= */}
      {/* MODAL 2: REGISTER NEW SKILL IN CATALOG                                     */}
      {/* ========================================================================= */}
      <ClayModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Register a New Skill in Catalog"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <ClayInput
            label="Skill Name"
            placeholder="e.g. B-Tree Index Optimization, React Server Components"
            value={newSkillName}
            onChange={(e) => setNewSkillName(e.target.value)}
          />

          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '0.4rem' }}>
              Skill Category
            </label>
            <select
              className="clay-select"
              value={newSkillCat}
              onChange={(e) => setNewSkillCat(Number(e.target.value))}
            >
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <ClayInput
            label="Skill Description"
            placeholder="Short summary of topics and concepts covered..."
            value={newSkillDesc}
            onChange={(e) => setNewSkillDesc(e.target.value)}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <ClayButton variant="secondary" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </ClayButton>
            <ClayButton variant="primary" onClick={handleCreateSkill}>
              Save Skill
            </ClayButton>
          </div>
        </div>
      </ClayModal>
    </div>
  );
};
