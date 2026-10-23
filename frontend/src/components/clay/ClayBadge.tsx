import React from 'react';

export interface ClayBadgeProps {
  variant?: 'sky' | 'lavender' | 'mint' | 'amber' | 'rose';
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const ClayBadge: React.FC<ClayBadgeProps> = ({
  variant = 'sky',
  children,
  icon,
  className = '',
  style,
}) => {
  return (
    <span className={`clay-badge clay-badge-${variant} ${className}`} style={style}>
      {icon && <span>{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
