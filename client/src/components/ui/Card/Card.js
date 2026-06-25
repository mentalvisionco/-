'use client';
import styles from './Card.module.css';

export default function Card({
  children,
  variant = 'default',
  padding = 'md',
  className = '',
  animate = false,
  onClick,
  ...props
}) {
  const classes = [
    styles.card,
    styles[variant],
    styles[`pad-${padding}`],
    animate ? styles.animate : '',
    onClick ? styles.clickable : '',
    className,
  ].filter(Boolean).join(' ');

  const handleKeyDown = (e) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick(e);
    }
  };

  return (
    <div
      className={classes}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }) {
  return <div className={`${styles.header} ${className}`}>{children}</div>;
}

export function CardBody({ children, className = '' }) {
  return <div className={`${styles.body} ${className}`}>{children}</div>;
}

export function CardFooter({ children, className = '' }) {
  return <div className={`${styles.footer} ${className}`}>{children}</div>;
}
