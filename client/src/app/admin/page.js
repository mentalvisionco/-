"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiCall, getCurrentUser, logout, showToast } from '@/lib/api';

// SVG Icons
const IconDashboard = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
);

const IconStudents = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const IconLectures = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
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

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [students, setStudents] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [lectures, setLectures] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [showLectureForm, setShowLectureForm] = useState(false);
  const [editLectureId, setEditLectureId] = useState(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formVideoUrl, setFormVideoUrl] = useState('');

  const openAddForm = () => {
    setEditLectureId(null); setFormTitle(''); setFormDesc(''); setFormVideoUrl('');
    setShowLectureForm(true);
  };

  const openEditForm = (lec) => {
    setEditLectureId(lec.id); setFormTitle(lec.title); setFormDesc(lec.description || ''); setFormVideoUrl(lec.videoUrl || '');
    setShowLectureForm(true);
  };

  const handleDeleteLecture = async (id, title) => {
    if (!confirm(`هل أنت متأكد من حذف المحاضرة: "${title}"؟\nسيتم حذف جميع التسليمات والتقييمات المرتبطة بها.`)) return;
    try { await apiCall(`/admin/lectures/${id}`, 'DELETE'); showToast('تم حذف المحاضرة بنجاح', 'success'); fetchData(); }
    catch (err) { showToast(err.message, 'error'); }
  };

  const handleDeleteStudent = async (id, name) => {
    if (!confirm(`هل أنت متأكد من حذف حساب الطالب: "${name}"؟\nسيتم حذف جميع بياناته وتسليماته بشكل نهائي.`)) return;
    try { await apiCall(`/admin/students/${id}`, 'DELETE'); showToast('تم حذف الطالب بنجاح', 'success'); fetchData(); }
    catch (err) { showToast(err.message, 'error'); }
  };

  const handleSaveLecture = async (e) => {
    e.preventDefault();
    try {
      if (editLectureId) {
        await apiCall(`/admin/lectures/${editLectureId}`, 'PUT', { title: formTitle, description: formDesc, videoUrl: formVideoUrl });
        showToast('تم التعديل بنجاح', 'success');
      } else {
        await apiCall('/admin/lectures', 'POST', { title: formTitle, description: formDesc, videoUrl: formVideoUrl });
        showToast('تمت الإضافة بنجاح', 'success');
      }
      setShowLectureForm(false); fetchData();
    } catch (err) { showToast(err.message, 'error'); }
  };

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'viewer')) {
      logout(); return;
    }
    setUser(currentUser);
    fetchData();
  }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [stdsRes, subsRes, lecsRes] = await Promise.all([
        apiCall('/admin/students'), apiCall('/admin/submissions'), apiCall('/lectures')
      ]);
      setStudents(stdsRes); setSubmissions(subsRes); setLectures(lecsRes);
    } catch (error) { showToast('خطأ في جلب بيانات الإدارة', 'error'); }
    finally { setLoading(false); }
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
            <button className={`nav-link w-full text-right ${currentView === 'dashboard' ? 'active' : ''}`} onClick={() => setCurrentView('dashboard')}>
              <IconDashboard />نظرة عامة
            </button>
          </li>
          <li className="nav-item">
            <button className={`nav-link w-full text-right ${currentView === 'students' ? 'active' : ''}`} onClick={() => setCurrentView('students')}>
              <IconStudents />الطلاب
            </button>
          </li>
          <li className="nav-item">
            <button className={`nav-link w-full text-right ${currentView === 'lectures' ? 'active' : ''}`} onClick={() => setCurrentView('lectures')}>
              <IconLectures />المحاضرات
            </button>
          </li>
        </ul>

        {/* User card with dropdown */}
        <div ref={dropdownRef} className={`user-card ${dropdownOpen ? 'open' : ''}`} onClick={() => setDropdownOpen(!dropdownOpen)}>
          <div className="avatar" style={{ background: 'var(--indigo)' }}>{user.role === 'viewer' ? 'م' : 'أ'}</div>
          <div className="user-card-info">
            <div className="user-card-name">{user.name}</div>
            <div className="user-card-role">{user.role === 'admin' ? 'مدير النظام' : 'مشاهد'}</div>
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
            <h2>لوحة الإدارة</h2>
            <p>متابعة أداء الطلاب والتقييمات</p>
          </div>
        </header>

        {/* Dashboard View */}
        {currentView === 'dashboard' && (
          <section className="section-fade" key="dashboard">
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
                          <a href={sub.fileUrl.startsWith('http') ? sub.fileUrl : '#'} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
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
          <section className="section-fade" key="students">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3>قائمة المتدربين</h3>
                <p>حساب التقييم بناءً على الحضور والتسليم</p>
              </div>
              <input type="text" className="form-control" placeholder="بحث بالاسم أو البريد..." style={{ width: '100%', maxWidth: '300px' }} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>الاسم</th><th>البريد</th><th>النقاط</th><th>التسليمات</th><th>التقييم</th>
                    {user.role === 'admin' && <th>إجراءات</th>}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const filteredStudents = students.filter(student =>
                      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      student.email.toLowerCase().includes(searchQuery.toLowerCase())
                    );
                    if (filteredStudents.length === 0) {
                      return (
                        <tr>
                          <td colSpan={user.role === 'admin' ? "6" : "5"} style={{ padding: '2rem', color: 'var(--ink-muted)', textAlign: 'center' }}>
                            {students.length === 0 ? 'لا يوجد طلاب مسجلين حتى الآن.' : 'لا توجد نتائج مطابقة للبحث.'}
                          </td>
                        </tr>
                      );
                    }
                    return filteredStudents.map(student => {
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
                          {user.role === 'admin' && (
                            <td>
                              <button className="btn" style={{ background: 'var(--red)', padding: '0.35rem 0.6rem', fontSize: '0.75rem', width: 'auto' }} onClick={() => handleDeleteStudent(student.id, student.name)}>
                                حذف
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Lectures View */}
        {currentView === 'lectures' && (
          <section className="section-fade" key="lectures">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <h3>إدارة المحاضرات</h3>
              {user.role === 'admin' && (
                <button className="btn" style={{ width: 'auto', fontSize: '0.85rem' }} onClick={openAddForm}>
                  + إضافة محاضرة
                </button>
              )}
            </div>

            {showLectureForm && (
              <div className="stat-card section-fade" style={{ marginBottom: '1.5rem' }}>
                <h4>{editLectureId ? 'تعديل المحاضرة' : 'إضافة محاضرة جديدة'}</h4>
                <form onSubmit={handleSaveLecture} style={{ marginTop: '1rem' }}>
                  <div className="form-group">
                    <label>عنوان المحاضرة</label>
                    <input type="text" className="form-control" required value={formTitle} onChange={e => setFormTitle(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>الوصف</label>
                    <input type="text" className="form-control" value={formDesc} onChange={e => setFormDesc(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>رابط الفيديو</label>
                    <input type="text" className="form-control" required value={formVideoUrl} onChange={e => setFormVideoUrl(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button type="submit" className="btn">حفظ</button>
                    <button type="button" className="btn" style={{ background: 'var(--surface-3)' }} onClick={() => setShowLectureForm(false)}>إلغاء</button>
                  </div>
                </form>
              </div>
            )}

            <div className="list-group">
              {lectures.length === 0 ? (
                <p style={{ color: 'var(--ink-muted)', padding: '1rem' }}>لا توجد محاضرات. أضف محاضرة جديدة.</p>
              ) : (
                lectures.map(lec => (
                  <div key={lec.id} className="list-item">
                    <div>
                      <h4>{lec.title}</h4>
                      <small>{lec.description || ''}</small>
                      <div style={{ marginTop: '0.25rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ color: 'var(--amber)', fontSize: '0.9rem' }}>★ {lec.avgRating || '0.0'}</span>
                        <small>({lec.ratingCount || 0} تقييم)</small>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {user.role === 'admin' && (
                        <>
                          <button className="btn" style={{ width: 'auto', padding: '0.45rem 0.85rem', background: 'var(--indigo)', fontSize: '0.82rem' }} onClick={() => openEditForm(lec)}>تعديل</button>
                          <button className="btn" style={{ width: 'auto', padding: '0.45rem 0.85rem', background: 'var(--red)', fontSize: '0.82rem' }} onClick={() => handleDeleteLecture(lec.id, lec.title)}>حذف</button>
                        </>
                      )}
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
