"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiCall, getCurrentUser, setCurrentUser, logout, showToast } from '@/lib/api';

// SVG Icons as components
const IconLectures = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
  </svg>
);

const IconTasks = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
  </svg>
);

const IconTrophy = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
  </svg>
);

const IconProfile = () => (
  <svg className="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);

const IconLogout = () => (
  <svg className="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

const IconChevron = () => (
  <svg className="user-card-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15"/>
  </svg>
);

export default function StudentDashboard() {
  const router = useRouter();

  const getYouTubeEmbedUrl = (url) => {
    if (!url) return null;
    let videoId = null;
    const watchMatch = url.match(/(?:youtube\.com|youtube-nocookie\.com)\/watch\?v=([\w-]+)/);
    if (watchMatch) videoId = watchMatch[1];
    if (!videoId) {
      const shortMatch = url.match(/youtu\.be\/([\w-]+)/);
      if (shortMatch) videoId = shortMatch[1];
    }
    if (!videoId) {
      const embedMatch = url.match(/(?:youtube\.com|youtube-nocookie\.com)\/embed\/([\w-]+)/);
      if (embedMatch) videoId = embedMatch[1];
    }
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  };

  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState('lectures');
  const [leaderboard, setLeaderboard] = useState([]);
  const [lectures, setLectures] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [activeLecture, setActiveLecture] = useState(null);
  const [taskUrl, setTaskUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentRating, setCurrentRating] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.role !== 'student') {
      logout();
      return;
    }
    setUser(currentUser);
    fetchData(currentUser);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const fetchData = async (currentUser) => {
    setLoading(true);
    try {
      const [meRes, lecsRes, subsRes, leadRes] = await Promise.all([
        apiCall('/me'),
        apiCall('/lectures'),
        apiCall('/submissions/me'),
        apiCall('/leaderboard')
      ]);
      const updatedUser = { ...currentUser, points: meRes.points };
      setCurrentUser(updatedUser);
      setUser(updatedUser);
      setLectures(lecsRes);
      setSubmissions(subsRes);
      setLeaderboard(leadRes);
    } catch (error) {
      showToast('خطأ في جلب البيانات', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openLecture = async (id) => {
    const lec = lectures.find(l => l.id === id);
    if (!lec) { showToast('المحاضرة غير متاحة', 'warning'); return; }
    setActiveLecture(lec);
    const existingSub = submissions.find(s => s.lectureId === id);
    setTaskUrl(existingSub ? existingSub.fileUrl : '');
    setCurrentView('singleLecture');
    try {
      const ratingRes = await apiCall(`/lectures/${id}/my-rating`);
      setCurrentRating(ratingRes.rating || 0);
    } catch { setCurrentRating(0); }
  };

  const handleRating = async (star) => {
    try {
      await apiCall(`/lectures/${activeLecture.id}/rate`, 'POST', { rating: star });
      setCurrentRating(star);
      showToast('تم حفظ التقييم، شكراً لك!', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleTaskSubmit = async (e) => {
    e.preventDefault();
    if (!activeLecture) return;
    try {
      const res = await apiCall('/submissions', 'POST', { lectureId: activeLecture.id, fileUrl: taskUrl });
      showToast(res.message || 'تم التسليم بنجاح', 'success');
      const [meRes, subsRes] = await Promise.all([apiCall('/me'), apiCall('/submissions/me')]);
      const updatedUser = { ...user, points: meRes.points };
      setCurrentUser(updatedUser);
      setUser(updatedUser);
      setSubmissions(subsRes);
    } catch (error) { showToast(error.message, 'error'); }
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
            <button className={`nav-link w-full text-right ${['lectures', 'singleLecture'].includes(currentView) ? 'active' : ''}`} onClick={() => setCurrentView('lectures')}>
              <IconLectures />المحاضرات
            </button>
          </li>
          <li className="nav-item">
            <button className={`nav-link w-full text-right ${currentView === 'tasks' ? 'active' : ''}`} onClick={() => setCurrentView('tasks')}>
              <IconTasks />التاسكات
            </button>
          </li>
          <li className="nav-item">
            <button className={`nav-link w-full text-right ${currentView === 'leaderboard' ? 'active' : ''}`} onClick={() => setCurrentView('leaderboard')}>
              <IconTrophy />الليدربورد
            </button>
          </li>
        </ul>

        {/* User card with dropdown */}
        <div ref={dropdownRef} className={`user-card ${dropdownOpen ? 'open' : ''}`} onClick={() => setDropdownOpen(!dropdownOpen)}>
          <div className="avatar">{user.name.charAt(0)}</div>
          <div className="user-card-info">
            <div className="user-card-name">{user.name}</div>
            <div className="user-card-role">{user.points || 0} نقطة</div>
          </div>
          <IconChevron />

          <div className={`dropdown-menu ${dropdownOpen ? 'open' : ''}`} onClick={(e) => e.stopPropagation()}>
            <button className="dropdown-item" onClick={() => { setDropdownOpen(false); router.push('/profile'); }}>
              <IconProfile />الملف الشخصي
            </button>
            <div className="dropdown-divider" />
            <button className="dropdown-item danger" onClick={logout}>
              <IconLogout />تسجيل الخروج
            </button>
          </div>
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
          </div>
        </header>

        {/* View: Tasks */}
        {currentView === 'tasks' && (
          <section className="section-fade" key="tasks">
            <h3>حالة التاسكات</h3>
            <p style={{ marginBottom: '1.5rem' }}>تابع مهامك المعلقة والمنجزة</p>
            <div className="list-group">
              {lectures.length === 0 ? (
                <p style={{ color: 'var(--ink-muted)', padding: '1rem' }}>لا توجد مهام متاحة.</p>
              ) : (
                lectures.map(lec => {
                  const isCompleted = submissions.some(s => s.lectureId === lec.id);
                  return (
                    <div key={lec.id} className="list-item" onClick={() => openLecture(lec.id)}>
                      <div>
                        <h4>مهمة: {lec.title}</h4>
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

        {/* View: Leaderboard */}
        {currentView === 'leaderboard' && (
          <section className="section-fade" key="leaderboard">
            <h3>الليدربورد — الطلاب الأعلى نقاطاً</h3>
            <p style={{ marginBottom: '1.5rem' }}>تنافس مع زملائك للوصول إلى القمة</p>

            {leaderboard.length === 0 ? (
              <p style={{ color: 'var(--ink-muted)', padding: '1rem' }}>لا يوجد طلاب بعد</p>
            ) : (
              <>
                {/* Top 3 Podium */}
                {leaderboard.length >= 1 && (
                  <div className="podium-grid">
                    {/* 2nd place */}
                    {leaderboard[1] ? (
                      <div className="podium-card silver">
                        <span className="podium-medal">🥈</span>
                        <div className="podium-name">{leaderboard[1].name}</div>
                        <div className="podium-points">{leaderboard[1].points} نقطة</div>
                      </div>
                    ) : <div />}
                    {/* 1st place */}
                    <div className="podium-card gold">
                      <span className="podium-medal">🥇</span>
                      <div className="podium-name">{leaderboard[0].name}</div>
                      <div className="podium-points">{leaderboard[0].points} نقطة</div>
                    </div>
                    {/* 3rd place */}
                    {leaderboard[2] ? (
                      <div className="podium-card bronze">
                        <span className="podium-medal">🥉</span>
                        <div className="podium-name">{leaderboard[2].name}</div>
                        <div className="podium-points">{leaderboard[2].points} نقطة</div>
                      </div>
                    ) : <div />}
                  </div>
                )}
                {/* Rest */}
                {leaderboard.slice(3).map((std, idx) => (
                  <div key={idx} className="podium-rank-rest">
                    <div className="podium-rank-num">{idx + 4}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{std.name}</div>
                    </div>
                    <span className="badge success">{std.points} نقطة</span>
                  </div>
                ))}
              </>
            )}
          </section>
        )}

        {/* View: All Lectures */}
        {currentView === 'lectures' && (
          <section className="section-fade" key="lectures">
            {/* Stats Grid */}
            <div className="stats-grid">
              <div className="stat-card">
                <h3>المحاضرات</h3>
                <div className="value">{lectures.length}</div>
              </div>
              <div className="stat-card">
                <h3>المسلّم</h3>
                <div className="value">{completed}</div>
              </div>
              <div className="stat-card">
                <h3>التقدم</h3>
                <div className="value">{progressPercent}%</div>
                <div className="progress-container">
                  <div className="progress-bar" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>
            </div>

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
          <section className="section-fade" key="singleLecture">
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

              <div style={{ width: '100%', height: '360px', background: '#000', borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: '2rem', border: '1px solid var(--surface-3)' }}>
                {activeLecture.videoUrl && getYouTubeEmbedUrl(activeLecture.videoUrl) ? (
                  <iframe width="100%" height="100%" src={getYouTubeEmbedUrl(activeLecture.videoUrl)} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
                ) : (
                  <video src={activeLecture.videoUrl} controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                )}
              </div>

              <div style={{ borderTop: '1px solid var(--surface-3)', paddingTop: '1.5rem' }}>
                <h3>تسليم المهمة</h3>
                {submissions.some(s => s.lectureId === activeLecture.id) && (
                  <div style={{ background: 'var(--green-soft)', color: 'var(--green)', padding: '0.65rem 1rem', borderRadius: 'var(--radius-sm)', marginTop: '0.75rem', fontSize: '0.88rem', fontWeight: '500' }}>
                    ✅ تم تسليم هذه المهمة مسبقًا — يمكنك تحديث الرابط
                  </div>
                )}
                <form style={{ marginTop: '0.85rem' }} onSubmit={handleTaskSubmit}>
                  <div className="form-group">
                    <label>رابط ملف الإنجاز (Drive / Github)</label>
                    <input type="url" className="form-control" required placeholder="https://..." value={taskUrl} onChange={(e) => setTaskUrl(e.target.value)} />
                  </div>
                  <button type="submit" className="btn" style={{ width: 'auto' }}>
                    {submissions.some(s => s.lectureId === activeLecture.id) ? 'تحديث التسليم' : 'تسليم'}
                  </button>
                </form>
              </div>

              <div style={{ borderTop: '1px solid var(--surface-3)', paddingTop: '1.5rem', marginTop: '1.5rem' }}>
                <h3>تقييم المحاضرة</h3>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.85rem', fontSize: '1.5rem', cursor: 'pointer' }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <span key={star} className="star" onClick={() => handleRating(star)} style={{ color: star <= currentRating ? 'var(--amber)' : 'var(--ink-ghost)' }}>
                      {star <= currentRating ? '★' : '☆'}
                    </span>
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
