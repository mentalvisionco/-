'use client';
import styles from './EmptyState.module.css';
import Button from '@/components/ui/Button/Button';

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) {
  return (
    <div className={`${styles.empty} ${className}`}>
      {Icon && (
        <div className={styles.iconWrap}>
          <Icon size={40} />
        </div>
      )}
      {title && <h4 className={styles.title}>{title}</h4>}
      {description && <p className={styles.description}>{description}</p>}
      {actionLabel && onAction && (
        <Button variant="secondary" size="sm" onClick={onAction} style={{ marginTop: 'var(--space-2)' }}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
