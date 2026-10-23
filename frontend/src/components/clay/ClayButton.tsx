import React from 'react';

interface ClayButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'mint' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export const ClayButton: React.FC<ClayButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  icon,
  ...props
}) => {
  let variantClass = 'clay-button-primary';
  if (variant === 'secondary') variantClass = 'clay-button-secondary';
  if (variant === 'mint') variantClass = 'clay-button-mint';
  if (variant === 'danger') variantClass = 'clay-button-danger';

  let sizeStyle: React.CSSProperties = {};
  if (size === 'sm') {
    sizeStyle = { padding: '0.45rem 0.9rem', fontSize: '0.825rem', borderRadius: '14px' };
  } else if (size === 'lg') {
    sizeStyle = { padding: '0.9rem 1.8rem', fontSize: '1.05rem', borderRadius: '22px' };
  }

  return (
    <button
      className={`clay-button ${variantClass} ${className}`}
      style={sizeStyle}
      {...props}
    >
      {icon && <span style={{ display: 'inline-flex' }}>{icon}</span>}
      <span>{children}</span>
    </button>
  );
};
