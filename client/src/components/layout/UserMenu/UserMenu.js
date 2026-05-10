'use client';
import { useState, useCallback } from 'react';
import styles from './UserMenu.module.css';
import { IconProfile, IconLogout, IconChevronUp } from '@/components/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import useClickOutside from '@/hooks/useClickOutside';

export default function UserMenu() {
  const { user, logout, isAdmin, isViewer } = useAuth();
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const ref = useClickOutside(useCallback(() => setOpen(false), []));

  if (!user) return null;

  const roleLabel = isAdmin ? 'مدير النظام' : isViewer ? 'مشاهد' : 'طالب';
  const initial = user.name?.charAt(0) || '?';

  return (
    <div ref={ref} className={styles.wrapper}>
      <button className={`${styles.trigger} ${open ? styles.open : ''}`} onClick={() => setOpen(!open)}>
        <div className={styles.avatar}>{initial}</div>
        <div className={styles.info}>
          <span className={styles.name}>{user.name}</span>
          <span className={styles.role}>{roleLabel}</span>
        </div>
        <IconChevronUp size={14} className={styles.chevron} />
      </button>

      {open && (
        <div className={styles.dropdown}>
          <button className={styles.item} onClick={() => { setOpen(false); router.push('/profile'); }}>
            <IconProfile size={16} />
            <span>الملف الشخصي</span>
          </button>
          <div className={styles.divider} />
          <button className={`${styles.item} ${styles.danger}`} onClick={logout}>
            <IconLogout size={16} />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      )}
    </div>
  );
}
