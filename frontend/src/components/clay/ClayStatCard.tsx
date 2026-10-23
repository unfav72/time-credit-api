import React from 'react';
import { ClayCard } from './ClayCard';

interface ClayStatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  badge?: string;
  badgeVariant?: 'sky' | 'lavender' | 'mint' | 'amber' | 'rose';
  trend?: string;
  iconBg?: string;
  onClick?: () => void;
}

export const ClayStatCard: React.FC<ClayStatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  badge,
  badgeVariant = 'mint',
  trend,
  iconBg = '#ede9fe',
  onClick,
}) => {
  return (
    <ClayCard
      variant={onClick ? 'interactive' : 'raised'}
      onClick={onClick}
      style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', position: 'relative' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '16px',
            backgroundColor: iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'inset 2px 2px 4px rgba(255, 255, 255, 0.8), 3px 3px 6px rgba(166, 180, 200, 0.3)',
          }}
        >
          {icon}
        </div>
        {badge && (
          <span className={`clay-badge clay-badge-${badgeVariant}`} style={{ fontSize: '0.7rem' }}>
            {badge}
          </span>
        )}
      </div>

      <div>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
          {title}
        </div>
        <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.1rem' }}>
          {value}
        </div>
      </div>

      {(subtitle || trend) && (
        <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {trend && <span style={{ fontWeight: 600, color: '#059669' }}>{trend}</span>}
          {subtitle && <span>{subtitle}</span>}
        </div>
      )}
    </ClayCard>
  );
};
