'use client';
import styles from './Button.module.css';
import { IconLoader } from '@/components/icons';

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled = false,
  icon: Icon = null,
  iconPosition = 'start',
  type = 'button',
  className = '',
  ...props
}) {
  const classes = [
    styles.btn,
    styles[variant],
    styles[size],
    fullWidth ? styles.fullWidth : '',
    loading ? styles.loading : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <IconLoader size={size === 'sm' ? 14 : 16} className={styles.spinner} />}
      {!loading && Icon && iconPosition === 'start' && <Icon size={size === 'sm' ? 14 : 16} />}
      {children && <span>{children}</span>}
      {!loading && Icon && iconPosition === 'end' && <Icon size={size === 'sm' ? 14 : 16} />}
    </button>
  );
}
