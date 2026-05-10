'use client';
import styles from './Header.module.css';

export default function Header({ title, subtitle, children, className = '' }) {
  return (
    <header className={`${styles.header} ${className}`}>
      <div className={styles.titleGroup}>
        <h2 className={styles.title}>{title}</h2>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {children && <div className={styles.actions}>{children}</div>}
    </header>
  );
}
