'use client';
import styles from './ProgressBar.module.css';

export default function ProgressBar({ value = 0, max = 100, label, showPercent = false, className = '' }) {
  const percent = Math.min(Math.round((value / max) * 100), 100);
  return (
    <div
      className={`${styles.wrapper} ${className}`}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label || 'مستوى التقدم'}
    >
      {(label || showPercent) && (
        <div className={styles.meta}>
          {label && <span className={styles.label}>{label}</span>}
          {showPercent && <span className={styles.percent}>{percent}%</span>}
        </div>
      )}
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
