import React, { useState } from 'react';
import {
  User,
  Mail,
  Shield,
  Coins,
  BookOpen,
  Award,
  Save,
  CheckCircle2
} from 'lucide-react';
import { ClayCard } from '../components/clay/ClayCard';
import { ClayButton } from '../components/clay/ClayButton';
import { ClayBadge } from '../components/clay/ClayBadge';
import { ClayInput } from '../components/clay/ClayInput';
import { api } from '../services/api';
import type { User as UserType } from '../types';

interface ProfilePageProps {
  currentUser: UserType;
  onUpdateUser: (user: UserType) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ currentUser, onUpdateUser }) => {
  const [name, setName] = useState(currentUser.full_name);
  const [bio, setBio] = useState(currentUser.bio || '');
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    try {
      const updated = await api.updateProfile(name, bio);
      onUpdateUser(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      alert('Failed to update profile in database: ' + (err?.message || err));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '780px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>My Profile</h1>
        <ClayBadge variant={currentUser.role === 'admin' ? 'rose' : 'sky'}>
          {currentUser.role.toUpperCase()}
        </ClayBadge>
      </div>

      {saved && (
        <div style={{ padding: '0.75rem 1rem', borderRadius: '14px', background: 'var(--pastel-mint-bg)', color: 'var(--pastel-mint-text)', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle2 size={16} /> Profile changes updated in database!
        </div>
      )}

      <ClayCard variant="raised" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1.5rem' }}>
          <div
            style={{
              width: '74px',
              height: '74px',
              borderRadius: '24px',
              background: 'linear-gradient(135deg, #818cf8, #6366f1)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              fontWeight: 800,
              boxShadow: 'var(--clay-shadow-float)'
            }}
          >
            {currentUser.full_name.charAt(0)}
          </div>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>{currentUser.full_name}</h2>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{currentUser.email}</div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem' }}>
              <ClayBadge variant="amber">{Number(currentUser.balance || 0).toFixed(2)} TimeCredits</ClayBadge>
              <ClayBadge variant="mint">Active Participant</ClayBadge>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <ClayInput
            label="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            icon={<User size={16} />}
          />

          <ClayInput
            label="Email Address (Unique Constraint)"
            value={currentUser.email}
            disabled
            icon={<Mail size={16} />}
          />

          <ClayInput
            label="Bio & Academic Background"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <ClayButton variant="primary" onClick={handleSave} icon={<Save size={15} />}>
              Save Profile
            </ClayButton>
          </div>
        </div>
      </ClayCard>
    </div>
  );
};
