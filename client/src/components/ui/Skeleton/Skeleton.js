'use client';
import styles from './Skeleton.module.css';

export function SkeletonLine({ width = '100%', height = '14px', className = '' }) {
  return <div className={`${styles.skeleton} ${className}`} style={{ width, height }} />;
}

export function SkeletonCircle({ size = 40, className = '' }) {
  return <div className={`${styles.skeleton} ${styles.circle} ${className}`} style={{ width: size, height: size }} />;
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`${styles.card} ${className}`}>
      <SkeletonLine width="40%" height="12px" />
      <SkeletonLine width="60%" height="20px" />
    </div>
  );
}

export function SkeletonList({ count = 3, className = '' }) {
  return (
    <div className={`${styles.list} ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={styles.listItem}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <SkeletonLine width="50%" height="14px" />
            <SkeletonLine width="80%" height="11px" />
          </div>
          <SkeletonLine width="70px" height="22px" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 4, cols = 4, className = '' }) {
  return (
    <div className={`${styles.table} ${className}`}>
      <div className={styles.tableHeader}>
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonLine key={i} width="80px" height="10px" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={styles.tableRow}>
          {Array.from({ length: cols }).map((_, j) => (
            <SkeletonLine key={j} width={j === 0 ? '120px' : '60px'} height="12px" />
          ))}
        </div>
      ))}
    </div>
  );
}
