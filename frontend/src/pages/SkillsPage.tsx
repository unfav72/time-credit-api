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
  Layers
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
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillCat, setNewSkillCat] = useState<number>(1);
  const [newSkillDesc, setNewSkillDesc] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'matches'>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [sk, cat] = await Promise.all([api.getSkills(), api.getCategories()]);
    setSkills(sk);
    setCategories(cat);
  };

  const handleCreateSkill = async () => {
    if (!newSkillName.trim()) return;
    try {
      await api.createSkill(newSkillName.trim(), newSkillCat, newSkillDesc.trim());
      await loadData();
      setCreateModalOpen(false);
      setNewSkillName('');
      setNewSkillDesc('');
    } catch (err: any) {
      alert('Failed creating skill in database: ' + err?.message);
    }
  };

  const filteredSkills = skills.filter(s => {
    const matchesCat = selectedCategory ? s.category_id === selectedCategory : true;
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) || 
                          (s.description || '').toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Skill Catalog & Exchange Matrix</h1>
            <ClayBadge variant="lavender">Relational Bridge</ClayBadge>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Many-to-many skill mapping between teachers offering skills and learners seeking them.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <ClayButton variant="primary" onClick={() => setCreateModalOpen(true)} icon={<Plus size={16} />}>
            Offer a New Skill
          </ClayButton>
        </div>
      </div>

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
          placeholder="Search skills (e.g. Normalization, React, SQL Joins...)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          icon={<Search size={16} />}
        />
      </div>

      {/* Skills Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
        {filteredSkills.map(skill => (
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

              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.25rem' }}>
                {skill.name}
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.5, marginTop: '0.4rem' }}>
                {skill.description}
              </p>
            </div>

            <div style={{ marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '0.5rem' }}>
              <ClayButton size="sm" variant="secondary" onClick={() => onNavigate('browse')} style={{ flex: 1 }}>
                Find Tutors
              </ClayButton>
              <ClayButton size="sm" variant="mint" onClick={() => onNavigate('browse')} style={{ flex: 1 }}>
                Offer Session
              </ClayButton>
            </div>
          </ClayCard>
        ))}
      </div>

      {/* Create Skill Modal */}
      <ClayModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Register a New Skill in Catalog"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <ClayInput
            label="Skill Name"
            placeholder="e.g. B-Tree Index Optimization"
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
            placeholder="Short summary of topics covered..."
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
