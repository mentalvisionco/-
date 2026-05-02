"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiCall, getCurrentUser, logout, showToast } from '@/lib/api';

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard'); // dashboard, students, lectures
  const [loading, setLoading] = useState(true);

  const [students, setStudents] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [lectures, setLectures] = useState([]);

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
      logout();
      return;
    }
    setUser(currentUser);
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [stdsRes, subsRes, lecsRes] = await Promise.all([
        apiCall('/admin/students'),
        apiCall('/admin/submissions'),
        apiCall('/lectures')
      ]);
      setStudents(stdsRes);
      setSubmissions(subsRes);
      setLectures(lecsRes);
    } catch (error) {
      showToast('خطأ في جلب بيانات الإدارة', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!user || loading) {
    return <div className="loading" style={{ height: '100vh' }}>جاري تحميل البيانات...</div>;
  }

  const totalLectures = lectures.length || 1;
  const totalExpected = students.length * totalLectures;
  const avgEng = totalExpected > 0 ? Math.round((submissions.length / totalExpected) * 100) : 0;

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
              className={`nav-link w-full text-right ${currentView === 'dashboard' ? 'active' : ''}`}
              onClick={() => setCurrentView('dashboard')}
            >
              نظرة عامة
            </button>
          </li>
          <li className="nav-item">
            <button 
              className={`nav-link w-full text-right ${currentView === 'students' ? 'active' : ''}`}
              onClick={() => setCurrentView('students')}
            >
              الطلاب
            </button>
          </li>
          <li className="nav-item">
            <button 
              className={`nav-link w-full text-right ${currentView === 'lectures' ? 'active' : ''}`}
              onClick={() => setCurrentView('lectures')}
            >
              المحاضرات
            </button>
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
            <h2>لوحة الإدارة</h2>
            <p>متابعة أداء الطلاب والتقييمات</p>
          </div>
          <div className="user-profile">
            <div className="avatar" style={{ background: 'var(--indigo)' }}>أ</div>
          </div>
        </header>

        {/* Dashboard View */}
        {currentView === 'dashboard' && (
          <section>
            <div className="stats-grid">
              <div className="stat-card">
                <h3>الطلاب</h3>
                <div className="value">{students.length}</div>
              </div>
              <div className="stat-card">
                <h3>التسليمات</h3>
                <div className="value">{submissions.length}</div>
              </div>
              <div className="stat-card">
                <h3>التفاعل</h3>
                <div className="value">{avgEng}%</div>
              </div>
            </div>

            <div style={{ marginTop: '1.5rem' }}>
              <h3>أحدث التسليمات</h3>
              <div className="list-group" style={{ marginTop: '0.85rem' }}>
                {submissions.length === 0 ? (
                  <p style={{ color: 'var(--ink-muted)', padding: '1rem' }}>لا توجد تسليمات حتى الآن.</p>
                ) : (
                  submissions.slice(0, 5).map(sub => (
                    <div key={sub.id} className="list-item">
                      <div>
                        <h4>{sub.studentName} - {sub.lectureTitle}</h4>
                        <small>
                          <a href={sub.fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                            عرض الملف المسلم
                          </a>
                        </small>
                      </div>
                      <span className="badge success">تم التسليم</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        )}

        {/* Students View */}
        {currentView === 'students' && (
          <section>
            <h3>قائمة المتدربين</h3>
            <p style={{ marginBottom: '1.25rem' }}>حساب التقييم بناءً على الحضور والتسليم</p>

            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>الاسم</th>
                    <th>البريد</th>
                    <th>النقاط</th>
                    <th>التسليمات</th>
                    <th>التقييم</th>
                  </tr>
                </thead>
                <tbody>
                  {students.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ padding: '2rem', color: 'var(--ink-muted)', textAlign: 'center' }}>
                        لا يوجد طلاب مسجلين حتى الآن.
                      </td>
                    </tr>
                  ) : (
                    students.map(student => {
                      const score = (student.submissionsCount * 10) + (student.points || 0);
                      let scoreBadge = 'danger';
                      if (score >= 100) scoreBadge = 'success';
                      else if (score >= 50) scoreBadge = 'warning';

                      return (
                        <tr key={student.id}>
                          <td>{student.name}</td>
                          <td style={{ color: 'var(--ink-muted)' }}>{student.email}</td>
                          <td>{student.points || 0}</td>
                          <td>{student.submissionsCount} / {totalLectures}</td>
                          <td><span className={`badge ${scoreBadge}`}>{score} نقطة</span></td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Lectures View */}
        {currentView === 'lectures' && (
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <h3>إدارة المحاضرات</h3>
              <button 
                className="btn" 
                style={{ width: 'auto', fontSize: '0.85rem' }} 
                onClick={() => alert('سيتم إضافة نافذة الإضافة قريباً')}
              >
                + إضافة محاضرة
              </button>
            </div>
            <div className="list-group">
              {lectures.length === 0 ? (
                <p style={{ color: 'var(--ink-muted)', padding: '1rem' }}>لا توجد محاضرات. أضف محاضرة جديدة.</p>
              ) : (
                lectures.map(lec => (
                  <div key={lec.id} className="list-item">
                    <div>
                      <h4>{lec.title}</h4>
                      <small>{lec.description || ''}</small>
                    </div>
                    <div>
                      <button className="btn" style={{ width: 'auto', padding: '0.45rem 0.85rem', background: 'var(--indigo)', fontSize: '0.82rem' }}>
                        تعديل
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
