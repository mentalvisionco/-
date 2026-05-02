"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiCall, getCurrentUser, setCurrentUser, logout, showToast } from '@/lib/api';

export default function StudentDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState('home'); // home, lectures, singleLecture
  const [lectures, setLectures] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [activeLecture, setActiveLecture] = useState(null);
  const [taskUrl, setTaskUrl] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.role !== 'student') {
      logout();
      return;
    }
    setUser(currentUser);
    fetchData(currentUser);
  }, []);

  const fetchData = async (currentUser) => {
    setLoading(true);
    try {
      const [meRes, lecsRes, subsRes] = await Promise.all([
        apiCall('/me'),
        apiCall('/lectures'),
        apiCall('/submissions/me')
      ]);

      const updatedUser = { ...currentUser, points: meRes.points };
      setCurrentUser(updatedUser);
      setUser(updatedUser);

      setLectures(lecsRes);
      setSubmissions(subsRes);
    } catch (error) {
      showToast('خطأ في جلب البيانات', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openLecture = (id) => {
    const lec = lectures.find(l => l.id === id);
    if (!lec) {
      showToast('المحاضرة غير متاحة', 'warning');
      return;
    }
    setActiveLecture(lec);
    const existingSub = submissions.find(s => s.lectureId === id);
    setTaskUrl(existingSub ? existingSub.fileUrl : '');
    setCurrentView('singleLecture');
  };

  const handleTaskSubmit = async (e) => {
    e.preventDefault();
    if (!activeLecture) return;

    try {
      const res = await apiCall('/submissions', 'POST', { lectureId: activeLecture.id, fileUrl: taskUrl });
      showToast(res.message || 'تم التسليم بنجاح', 'success');

      // Refresh Data
      const [meRes, subsRes] = await Promise.all([
        apiCall('/me'),
        apiCall('/submissions/me')
      ]);
      const updatedUser = { ...user, points: meRes.points };
      setCurrentUser(updatedUser);
      setUser(updatedUser);
      setSubmissions(subsRes);
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  if (!user || loading) {
    return <div className="loading" style={{ height: '100vh' }}>جاري تحميل البيانات...</div>;
  }

  const totalLectures = lectures.length || 1;
  const completed = submissions.length;
  const progressPercent = Math.min(Math.round((completed / totalLectures) * 100), 100);

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <img src="/logo.svg" alt="Mental Vision" className="logo-img" />
        </div>
        <ul className="nav-links">
          <li className="nav-item">
            <button
              className={`nav-link w-full text-right ${currentView === 'home' ? 'active' : ''}`}
              onClick={() => setCurrentView('home')}
            >
              الرئيسية
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link w-full text-right ${['lectures', 'singleLecture'].includes(currentView) ? 'active' : ''}`}
              onClick={() => setCurrentView('lectures')}
            >
              المحاضرات
            </button>
          </li>
          <li className="nav-item">
            <button className="nav-link w-full text-right">المهام</button>
          </li>
        </ul>
        <div style={{ marginTop: 'auto' }}>
          <button className="btn" style={{ background: 'var(--red)', fontSize: '0.85rem' }} onClick={logout}>
            خروج
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="header">
          <div>
            <h2>مرحبًا، {user.name.split(' ')[0]}!</h2>
            <p>تابع تقدّمك في المسار التدريبي</p>
          </div>
          <div className="user-profile">
            <div className="points-display">
              <span>{user.points || 0}</span> نقطة
            </div>
            <div className="avatar">{user.name.charAt(0)}</div>
          </div>
        </header>

        {/* View: Home */}
        {currentView === 'home' && (
          <section>
            <div className="stats-grid">
              <div className="stat-card">
                <h3>الإنجاز</h3>
                <div className="value">{progressPercent}%</div>
                <div className="progress-container">
                  <div className="progress-bar" style={{ width: `${progressPercent}%` }}></div>
                </div>
              </div>
              <div className="stat-card">
                <h3>المحاضرات</h3>
                <div className="value">{completed} / {totalLectures}</div>
              </div>
              <div className="stat-card">
                <h3>التسليمات</h3>
                <div className="value">{completed}</div>
              </div>
            </div>

            <div style={{ marginTop: '1.5rem' }}>
              <h3>أحدث المحاضرات</h3>
              <div className="list-group" style={{ marginTop: '0.85rem' }}>
                {lectures.length === 0 ? (
                  <p style={{ color: 'var(--ink-muted)', padding: '1rem' }}>لا توجد محاضرات متاحة حالياً.</p>
                ) : (
                  lectures.slice(0, 3).map(lec => {
                    const isCompleted = submissions.some(s => s.lectureId === lec.id);
                    return (
                      <div key={lec.id} className="list-item" onClick={() => openLecture(lec.id)}>
                        <div>
                          <h4>{lec.title}</h4>
                          <small>{lec.description || ''}</small>
                        </div>
                        <span className={`badge ${isCompleted ? 'success' : 'warning'}`}>
                          {isCompleted ? 'مكتملة' : 'قيد الانتظار'}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        )}

        {/* View: All Lectures */}
        {currentView === 'lectures' && (
          <section>
            <h3>جميع المحاضرات</h3>
            <p style={{ marginBottom: '1.5rem' }}>اختر محاضرة للمشاهدة وتسليم المهام</p>
            <div className="list-group">
              {lectures.length === 0 ? (
                <p style={{ color: 'var(--ink-muted)', padding: '1rem' }}>لا توجد محاضرات متاحة حالياً.</p>
              ) : (
                lectures.map(lec => {
                  const isCompleted = submissions.some(s => s.lectureId === lec.id);
                  return (
                    <div key={lec.id} className="list-item" onClick={() => openLecture(lec.id)}>
                      <div>
                        <h4>{lec.title}</h4>
                        <small>{lec.description || ''}</small>
                      </div>
                      <span className={`badge ${isCompleted ? 'success' : 'danger'}`}>
                        {isCompleted ? 'تم التسليم' : 'لم يتم التسليم'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        )}

        {/* View: Single Lecture */}
        {currentView === 'singleLecture' && activeLecture && (
          <section>
            <button
              className="btn"
              style={{ width: 'auto', marginBottom: '1.25rem', background: 'var(--surface-2)', color: 'var(--ink)', fontSize: '0.85rem' }}
              onClick={() => setCurrentView('lectures')}
            >
              ← رجوع
            </button>
            <div className="stat-card" style={{ padding: '2rem' }}>
              <h2>{activeLecture.title}</h2>
              <p style={{ marginBottom: '1.5rem' }}>{activeLecture.description || ''}</p>

              <div style={{ width: '100%', height: '360px', background: 'var(--surface-2)', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem', border: '1px solid var(--surface-3)' }}>
                <span style={{ color: 'var(--ink-muted)', fontSize: '0.95rem' }}>▶ منطقة عرض الفيديو</span>
              </div>

              <div style={{ borderTop: '1px solid var(--surface-3)', paddingTop: '1.5rem' }}>
                <h3>تسليم المهمة</h3>
                <form style={{ marginTop: '0.85rem' }} onSubmit={handleTaskSubmit}>
                  <div className="form-group">
                    <label>رابط ملف الإنجاز (Drive / Github)</label>
                    <input
                      type="url"
                      className="form-control"
                      required
                      placeholder="https://..."
                      value={taskUrl}
                      onChange={(e) => setTaskUrl(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn" style={{ width: 'auto' }}>تسليم</button>
                </form>
              </div>

              <div style={{ borderTop: '1px solid var(--surface-3)', paddingTop: '1.5rem', marginTop: '1.5rem' }}>
                <h3>تقييم المحاضرة</h3>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.85rem', fontSize: '1.5rem', cursor: 'pointer' }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <span key={star} className="star">☆</span>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
