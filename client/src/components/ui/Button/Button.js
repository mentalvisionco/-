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
  iconOnly = false,
  tooltip = '',
  onClick,
  ...props
}) {
  const isIconOnly = iconOnly || (!children && Icon);
  
  const classes = [
    styles.btn,
    styles[variant],
    styles[size],
    fullWidth ? styles.fullWidth : '',
    loading ? styles.loading : '',
    isIconOnly ? styles.iconOnly : '',
    className,
  ].filter(Boolean).join(' ');

  const handleClick = (e) => {
    if (disabled || loading) return;

    const button = e.currentTarget;
    const circle = document.createElement('span');
    const diameter = Math.max(button.clientWidth, button.clientHeight);
    const radius = diameter / 2;

    const rect = button.getBoundingClientRect();
    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${e.clientX - rect.left - radius}px`;
    circle.style.top = `${e.clientY - rect.top - radius}px`;
    circle.classList.add(styles.rippleSpan);

    const existingRipple = button.getElementsByClassName(styles.rippleSpan)[0];
    if (existingRipple) {
      existingRipple.remove();
    }

    button.appendChild(circle);
    onClick?.(e);
  };

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      onClick={handleClick}
      title={tooltip || props.title}
      {...props}
    >
      {loading && <IconLoader size={size === 'sm' ? 14 : 16} className={styles.spinner} />}
      {!loading && Icon && iconPosition === 'start' && <Icon size={size === 'sm' ? 14 : 16} />}
      {children && <span>{children}</span>}
      {!loading && Icon && iconPosition === 'end' && <Icon size={size === 'sm' ? 14 : 16} />}
    </button>
  );
}

