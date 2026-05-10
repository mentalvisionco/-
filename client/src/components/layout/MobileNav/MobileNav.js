'use client';
import styles from './MobileNav.module.css';

export default function MobileNav({ navItems = [], currentView, onViewChange }) {
  return (
    <nav className={styles.nav}>
      {navItems.map(item => (
        <button
          key={item.id}
          className={`${styles.tab} ${currentView === item.id || (item.activeIds && item.activeIds.includes(currentView)) ? styles.active : ''}`}
          onClick={() => onViewChange(item.id)}
        >
          <item.icon size={20} className={styles.icon} />
          <span className={styles.label}>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
