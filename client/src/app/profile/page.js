"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { apiCall } from '@/lib/api';
import Button from '@/components/ui/Button/Button';
import Input from '@/components/ui/Input/Input';
import Card from '@/components/ui/Card/Card';
import Badge from '@/components/ui/Badge/Badge';
import { IconArrowRight, IconLock, IconMail, IconAward, IconCalendar, IconProfile } from '@/components/icons';
import styles from './page.module.css';

export default function ProfilePage() {
  const router = useRouter();
  const { user, ready } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (ready && !user) { router.push('/'); return; }
    if (ready && user) {
      apiCall('/me').then(setProfile).catch(() => toast.error('خطأ في جلب البيانات')).finally(() => setLoading(false));
    }
  }, [ready]);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setChangingPassword(true);
    try {
      const res = await apiCall('/me/password', 'PUT', { currentPassword, newPassword });
      toast.success(res.message);
      setCurrentPassword(''); setNewPassword('');
    } catch (err) { toast.error(err.message); }
    finally { setChangingPassword(false); }
  };

  const goBack = () => {
    if (user?.role === 'admin' || user?.role === 'viewer') router.push('/admin');
    else router.push('/student');
  };

  const getRoleName = (role) => ({ admin: 'مدير النظام', viewer: 'مشاهد', student: 'طالب' }[role] || role);

  if (loading || !profile) return null;

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        <Button variant="ghost" size="sm" onClick={goBack} icon={IconArrowRight} iconPosition="start">
          رجوع
        </Button>

        <Card padding="lg" animate className={styles.profileCard}>
          <div className={styles.avatarLarge}>{profile.name?.charAt(0)}</div>
          <h2 className={styles.name}>{profile.name}</h2>
          <Badge variant="accent">{getRoleName(profile.role)}</Badge>

          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <IconMail size={16} className={styles.infoIcon} />
              <div>
                <span className={styles.infoLabel}>البريد الإلكتروني</span>
                <span className={styles.infoValue}>{profile.email}</span>
              </div>
            </div>
            <div className={styles.infoItem}>
              <IconAward size={16} className={styles.infoIcon} />
              <div>
                <span className={styles.infoLabel}>النقاط</span>
                <span className={styles.infoValue} style={{ color: 'var(--accent)' }}>{profile.points || 0} نقطة</span>
              </div>
            </div>
            <div className={styles.infoItem}>
              <IconProfile size={16} className={styles.infoIcon} />
              <div>
                <span className={styles.infoLabel}>الدور</span>
                <span className={styles.infoValue}>{getRoleName(profile.role)}</span>
              </div>
            </div>
            <div className={styles.infoItem}>
              <IconCalendar size={16} className={styles.infoIcon} />
              <div>
                <span className={styles.infoLabel}>تاريخ الانضمام</span>
                <span className={styles.infoValue}>
                  {profile.created_at ? new Date(profile.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                </span>
              </div>
            </div>
          </div>
        </Card>

        <Card padding="lg" animate className={styles.passwordCard}>
          <div className={styles.passwordHeader}>
            <IconLock size={18} />
            <h3>تغيير كلمة المرور</h3>
          </div>
          <form onSubmit={handlePasswordChange} className={styles.passwordForm}>
            <Input label="كلمة المرور الحالية" type="password" required placeholder="••••••••" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
            <Input label="كلمة المرور الجديدة" type="password" required minLength="8" placeholder="8 أحرف على الأقل" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            <Button type="submit" variant="primary" loading={changingPassword} style={{ alignSelf: 'flex-start' }}>
              تغيير كلمة المرور
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
