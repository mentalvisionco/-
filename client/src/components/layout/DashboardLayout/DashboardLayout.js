'use client';
import styles from './DashboardLayout.module.css';
import Sidebar from '@/components/layout/Sidebar/Sidebar';
import MobileNav from '@/components/layout/MobileNav/MobileNav';

export default function DashboardLayout({
  navItems,
  currentView,
  onViewChange,
  mobileHeader,
  children,
}) {
  return (
    <div className={styles.dashboard}>
      <Sidebar navItems={navItems} currentView={currentView} onViewChange={onViewChange} />

      <main className={styles.main}>
        {mobileHeader && <div className={styles.mobileHeader}>{mobileHeader}</div>}
        <div className={styles.content}>
          {children}
        </div>
      </main>

      <MobileNav navItems={navItems} currentView={currentView} onViewChange={onViewChange} />
    </div>
  );
}
