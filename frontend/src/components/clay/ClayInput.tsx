import React from 'react';

interface ClayInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const ClayInput: React.FC<ClayInputProps> = ({
  label,
  error,
  icon,
  className = '',
  ...props
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '100%' }}>
      {label && (
        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
          {label}
        </label>
      )}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {icon && (
          <span style={{ position: 'absolute', left: '1rem', color: '#94a3b8', pointerEvents: 'none', display: 'flex' }}>
            {icon}
          </span>
        )}
        <input
          className={`clay-input ${className}`}
          style={{ paddingLeft: icon ? '2.8rem' : '1.1rem' }}
          {...props}
        />
      </div>
      {error && (
        <span style={{ fontSize: '0.775rem', color: '#dc2626', fontWeight: 500 }}>
          {error}
        </span>
      )}
    </div>
  );
};
