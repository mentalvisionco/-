'use client';
import styles from './StatCard.module.css';

export default function StatCard({ label, value, icon: Icon, trend, className = '' }) {
  return (
    <div className={`${styles.card} ${className}`}>
      <div className={styles.top}>
        <span className={styles.label}>{label}</span>
        {Icon && <div className={styles.iconWrap}><Icon size={18} /></div>}
      </div>
      <div className={styles.value}>{value}</div>
      {trend !== undefined && (
        <span className={`${styles.trend} ${trend >= 0 ? styles.up : styles.down}`}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
        </span>
      )}
    </div>
  );
}
