import React, { useState } from 'react';
import {
  Settings,
  Database,
  Smartphone,
  Shield,
  RotateCcw,
  CheckCircle2,
  Cpu,
  Layers,
  Server
} from 'lucide-react';
import { ClayCard } from '../components/clay/ClayCard';
import { ClayButton } from '../components/clay/ClayButton';
import { ClayBadge } from '../components/clay/ClayBadge';
import { api } from '../services/api';

export const SettingsPage: React.FC = () => {
  const [engineMode, setEngineMode] = useState<'auto' | 'wasm' | 'php'>('auto');
  const [saved, setSaved] = useState(false);

  const handleReset = () => {
    if (confirm('Reset local cache and restore all demo state?')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '820px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Platform Settings</h1>
        <ClayBadge variant="lavender">Configuration</ClayBadge>
      </div>

      {saved && (
        <div style={{ padding: '0.75rem 1rem', borderRadius: '14px', background: 'var(--pastel-mint-bg)', color: 'var(--pastel-mint-text)', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle2 size={16} /> Configuration saved!
        </div>
      )}

      {/* SQL Engine Mode */}
      <ClayCard variant="raised" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Database size={18} color="#6366f1" />
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800 }}>SQL Query Execution Engine</h2>
        </div>
        <p style={{ color: '#64748b', fontSize: '0.875rem', lineHeight: 1.5 }}>
          TimeCredit Live supports both a local PHP 8.3+ PDO REST backend and an embedded WebAssembly relational database engine for offline resilience.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '0.6rem 0.85rem', borderRadius: '12px', background: engineMode === 'auto' ? 'var(--pastel-lavender-bg)' : '#f8fafc' }}>
            <input
              type="radio"
              name="engineMode"
              checked={engineMode === 'auto'}
              onChange={() => setEngineMode('auto')}
            />
            <div>
              <strong style={{ fontSize: '0.875rem' }}>Auto-Detect (Recommended)</strong>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Connects to PHP/MySQL backend if running, with instant fallback to WebAssembly SQL engine.</div>
            </div>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '0.6rem 0.85rem', borderRadius: '12px', background: engineMode === 'wasm' ? 'var(--pastel-lavender-bg)' : '#f8fafc' }}>
            <input
              type="radio"
              name="engineMode"
              checked={engineMode === 'wasm'}
              onChange={() => setEngineMode('wasm')}
            />
            <div>
              <strong style={{ fontSize: '0.875rem' }}>Strict WebAssembly SQL Engine (Offline / Standalone)</strong>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Executes real relational SQL queries directly in the browser with local persistence.</div>
            </div>
          </label>
        </div>
      </ClayCard>

      {/* Progressive Web App Status */}
      <ClayCard variant="raised" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Smartphone size={18} color="#059669" />
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Progressive Web App (PWA) Status</h2>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <ClayBadge variant="mint">Manifest: manifest.webmanifest</ClayBadge>
          <ClayBadge variant="mint">Service Worker: sw.js (Active)</ClayBadge>
          <ClayBadge variant="sky">Display: Standalone</ClayBadge>
          <ClayBadge variant="lavender">Theme: #6366f1</ClayBadge>
        </div>
        <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.5 }}>
          The application is fully installable on desktop Chrome/Edge, Android, and iOS devices. Static assets and the application shell are cached locally for offline accessibility.
        </p>
      </ClayCard>

      {/* Danger Zone: Reset Data */}
      <ClayCard variant="inset" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #fecaca' }}>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#dc2626' }}>Reset Local Practice State</h3>
          <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Clears local storage, resets practice SQL tables, and reloads clean seed records.
          </p>
        </div>
        <ClayButton variant="danger" size="sm" onClick={handleReset} icon={<RotateCcw size={14} />}>
          Reset Everything
        </ClayButton>
      </ClayCard>
    </div>
  );
};
