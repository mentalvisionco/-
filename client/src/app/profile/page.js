"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiCall, getCurrentUser, getToken, logout, showToast } from '@/lib/api';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    const currentUser = getCurrentUser();
    const token = getToken();
    if (!currentUser || !token) {
      router.push('/');
      return;
    }
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const me = await apiCall('/me');
      setUser(me);
    } catch {
      showToast('خطأ في جلب البيانات', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setChangingPassword(true);
    try {
      const res = await apiCall('/me/password', 'PUT', { currentPassword, newPassword });
      showToast(res.message, 'success');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setChangingPassword(false);
    }
  };

  const goBack = () => {
    const currentUser = getCurrentUser();
    if (currentUser?.role === 'admin' || currentUser?.role === 'viewer') {
      router.push('/admin');
    } else {
      router.push('/student');
    }
  };

  const getRoleName = (role) => {
    const roles = { admin: 'مدير النظام', viewer: 'مشاهد', student: 'طالب' };
    return roles[role] || role;
  };

  if (loading) {
    return <div className="loading" style={{ height: '100vh' }}>جاري التحميل...</div>;
  }

  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-0)', padding: '2rem' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        <button
          className="btn"
          style={{ width: 'auto', marginBottom: '1.5rem', background: 'var(--surface-2)', color: 'var(--ink)', fontSize: '0.85rem' }}
          onClick={goBack}
        >
          ← رجوع
        </button>

        <div className="profile-card section-fade" style={{ textAlign: 'center' }}>
          <div className="profile-avatar-large">
            {user.name.charAt(0)}
          </div>
          <h2 style={{ marginBottom: '0.2rem' }}>{user.name}</h2>
          <span className="badge success" style={{ fontSize: '0.8rem' }}>{getRoleName(user.role)}</span>

          <div className="profile-info-grid" style={{ textAlign: 'right' }}>
            <div className="profile-info-item">
              <span className="profile-info-label">البريد الإلكتروني</span>
              <span className="profile-info-value">{user.email}</span>
            </div>
            <div className="profile-info-item">
              <span className="profile-info-label">النقاط</span>
              <span className="profile-info-value" style={{ color: 'var(--accent)' }}>{user.points || 0} نقطة</span>
            </div>
            <div className="profile-info-item">
              <span className="profile-info-label">الدور</span>
              <span className="profile-info-value">{getRoleName(user.role)}</span>
            </div>
            <div className="profile-info-item">
              <span className="profile-info-label">تاريخ الانضمام</span>
              <span className="profile-info-value">
                {user.created_at ? new Date(user.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
              </span>
            </div>
          </div>
        </div>

        <div className="profile-card section-fade" style={{ animationDelay: '0.1s' }}>
          <h3 style={{ marginBottom: '1rem' }}>تغيير كلمة المرور</h3>
          <form onSubmit={handlePasswordChange}>
            <div className="form-group">
              <label>كلمة المرور الحالية</label>
              <input
                type="password"
                className="form-control"
                required
                placeholder="••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>كلمة المرور الجديدة</label>
              <input
                type="password"
                className="form-control"
                required
                minLength="8"
                placeholder="8 أحرف على الأقل"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <button type="submit" className="btn" style={{ width: 'auto' }} disabled={changingPassword}>
              {changingPassword ? 'جاري التغيير...' : 'تغيير كلمة المرور'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
