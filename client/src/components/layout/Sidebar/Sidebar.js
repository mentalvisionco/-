'use client';
import styles from './Sidebar.module.css';
import UserMenu from '@/components/layout/UserMenu/UserMenu';
import Image from 'next/image';

export default function Sidebar({ navItems = [], currentView, onViewChange }) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <Image src="/logo.svg" alt="Mental Vision" width={120} height={40} className={styles.logo} priority />
      </div>

      <nav className={styles.nav}>
        <ul className={styles.navList}>
          {navItems.map(item => (
            <li key={item.id}>
              <button
                className={`${styles.navLink} ${currentView === item.id || (item.activeIds && item.activeIds.includes(currentView)) ? styles.active : ''}`}
                onClick={() => onViewChange(item.id)}
              >
                <item.icon size={18} className={styles.navIcon} />
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <UserMenu />
    </aside>
  );
}
