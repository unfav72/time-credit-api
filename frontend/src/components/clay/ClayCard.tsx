import React from 'react';

interface ClayCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'raised' | 'inset' | 'interactive';
  className?: string;
  children: React.ReactNode;
}

export const ClayCard: React.FC<ClayCardProps> = ({
  variant = 'raised',
  className = '',
  children,
  ...props
}) => {
  let variantClass = 'clay-card';
  if (variant === 'inset') {
    variantClass = 'clay-card-inset';
  } else if (variant === 'interactive') {
    variantClass = 'clay-card clay-card-interactive';
  }

  return (
    <div className={`${variantClass} ${className}`} {...props}>
      {children}
    </div>
  );
};
