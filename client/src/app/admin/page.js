"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { apiCall } from '@/lib/api';
import DashboardLayout from '@/components/layout/DashboardLayout/DashboardLayout';
import Header from '@/components/layout/Header/Header';
import StatCard from '@/components/dashboard/StatCard/StatCard';
import LectureForm from '@/components/lectures/LectureForm/LectureForm';
import RatingsModal from '@/components/lectures/RatingsModal/RatingsModal';
import TaskForm from '@/components/tasks/TaskForm/TaskForm';
import StudentModal from '@/components/students/StudentModal/StudentModal';
import Button from '@/components/ui/Button/Button';
import Badge from '@/components/ui/Badge/Badge';
import Card from '@/components/ui/Card/Card';
import Input from '@/components/ui/Input/Input';
import EmptyState from '@/components/ui/EmptyState/EmptyState';
import ConfirmDialog from '@/components/ui/ConfirmDialog/ConfirmDialog';
import BackupPanel from '@/components/backup/BackupPanel/BackupPanel';
import AttendancePanel from '@/components/attendance/AttendancePanel/AttendancePanel';
import { SkeletonCard, SkeletonList, SkeletonTable } from '@/components/ui/Skeleton/Skeleton';
import { IconDashboard, IconStudents, IconLectures, IconTasksAlt, IconPlus, IconEdit, IconTrash, IconSearch, IconExternalLink, IconStarFilled, IconEye, IconBarChart, IconFileText, IconSettings, IconClipboardCheck, IconUpload } from '@/components/icons';
import Image from 'next/image';
import styles from './page.module.css';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'نظرة عامة', icon: IconDashboard },
  { id: 'students', label: 'الطلاب', icon: IconStudents },
  { id: 'attendance', label: 'الحضور', icon: IconClipboardCheck },
  { id: 'lectures', label: 'المحاضرات', icon: IconLectures },
  { id: 'tasks', label: 'التاسكات', icon: IconTasksAlt },
  { id: 'submissions', label: 'التسليمات', icon: IconFileText },
  { id: 'tools', label: 'الأدوات', icon: IconSettings },
];

export default function AdminDashboard() {
  const { user, logout, isAdmin, isAdminOrViewer, ready } = useAuth();
  const { toast } = useToast();

  const [currentView, setCurrentView] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [lectures, setLectures] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Lecture form
  const [showLectureForm, setShowLectureForm] = useState(false);
  const [editLectureId, setEditLectureId] = useState(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formMaterialUrl, setFormMaterialUrl] = useState('');

  // Task form
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editTaskId, setEditTaskId] = useState(null);
  const [taskFormTitle, setTaskFormTitle] = useState('');
  const [taskFormDesc, setTaskFormDesc] = useState('');
  const [taskFormUrl, setTaskFormUrl] = useState('');

  // Student modal
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [editStudentId, setEditStudentId] = useState(null);
  const [studentModalData, setStudentModalData] = useState(null);

  // Ratings modal
  const [showRatingsModal, setShowRatingsModal] = useState(false);
  const [lectureRatings, setLectureRatings] = useState([]);
  const [ratingsLectureTitle, setRatingsLectureTitle] = useState('');

  // Confirm dialog
  const [confirmState, setConfirmState] = useState({ open: false, title: '', message: '', onConfirm: null });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [stds, subs, lecs, tsks] = await Promise.all([
        apiCall('/admin/students'), apiCall('/admin/submissions'), apiCall('/lectures'), apiCall('/tasks')
      ]);
      setStudents(stds); setSubmissions(subs); setLectures(lecs); setTasks(tsks);
    } catch { toast.error('خطأ في جلب بيانات الإدارة'); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => {
    if (ready && !isAdminOrViewer) { logout(); return; }
    if (ready && isAdminOrViewer) fetchData();
  }, [ready, isAdminOrViewer, logout, fetchData]);

  // ——— Lecture handlers ———
  const openAddLecture = () => { setEditLectureId(null); setFormTitle(''); setFormDesc(''); setFormMaterialUrl(''); setShowLectureForm(true); };
  const openEditLecture = (l) => { setEditLectureId(l.id); setFormTitle(l.title); setFormDesc(l.description || ''); setFormMaterialUrl(l.materialUrl || ''); setShowLectureForm(true); };
  const handleSaveLecture = async (e) => {
    e.preventDefault();
    try {
      if (editLectureId) {
        await apiCall(`/admin/lectures/${editLectureId}`, 'PUT', { title: formTitle, description: formDesc, materialUrl: formMaterialUrl });
        toast.success('تم التعديل بنجاح');
      } else {
        await apiCall('/admin/lectures', 'POST', { title: formTitle, description: formDesc, materialUrl: formMaterialUrl });
        toast.success('تمت الإضافة بنجاح');
      }
      setShowLectureForm(false); fetchData();
    } catch (err) { toast.error(err.message); }
  };
  const handleDeleteLecture = (id, title) => {
    setConfirmState({
      open: true,
      title: 'حذف المحاضرة',
      message: `هل أنت متأكد من حذف "${title}"؟ سيتم حذف جميع التقييمات المرتبطة بها.`,
      onConfirm: async () => {
        try { await apiCall(`/admin/lectures/${id}`, 'DELETE'); toast.success('تم حذف المحاضرة'); fetchData(); }
        catch (err) { toast.error(err.message); }
        setConfirmState(s => ({ ...s, open: false }));
      }
    });
  };
  const openRatings = async (lec) => {
    try {
      const res = await apiCall(`/admin/lectures/${lec.id}/ratings`);
      setLectureRatings(res); setRatingsLectureTitle(lec.title); setShowRatingsModal(true);
    } catch (err) { toast.error(err.message); }
  };

  // ——— Task handlers ———
  const openAddTask = () => { setEditTaskId(null); setTaskFormTitle(''); setTaskFormDesc(''); setTaskFormUrl(''); setShowTaskForm(true); };
  const openEditTask = (t) => { setEditTaskId(t.id); setTaskFormTitle(t.title); setTaskFormDesc(t.description || ''); setTaskFormUrl(t.taskUrl || ''); setShowTaskForm(true); };
  const handleSaveTask = async (e) => {
    e.preventDefault();
    try {
      if (editTaskId) {
        await apiCall(`/admin/tasks/${editTaskId}`, 'PUT', { title: taskFormTitle, description: taskFormDesc, taskUrl: taskFormUrl });
        toast.success('تم التعديل بنجاح');
      } else {
        await apiCall('/admin/tasks', 'POST', { title: taskFormTitle, description: taskFormDesc, taskUrl: taskFormUrl });
        toast.success('تمت الإضافة بنجاح');
      }
      setShowTaskForm(false); fetchData();
    } catch (err) { toast.error(err.message); }
  };
  const handleDeleteTask = (id, title) => {
    setConfirmState({
      open: true,
      title: 'حذف المهمة',
      message: `هل أنت متأكد من حذف "${title}"؟ سيتم حذف جميع التسليمات المرتبطة.`,
      onConfirm: async () => {
        try { await apiCall(`/admin/tasks/${id}`, 'DELETE'); toast.success('تم حذف المهمة'); fetchData(); }
        catch (err) { toast.error(err.message); }
        setConfirmState(s => ({ ...s, open: false }));
      }
    });
  };

  // ——— Student handler ———
  const openAddStudent = () => {
    setEditStudentId(null);
    setStudentModalData(null);
    setShowStudentModal(true);
  };
  const openEditStudent = (s) => {
    setEditStudentId(s.id);
    setStudentModalData(s);
    setShowStudentModal(true);
  };
  const handleSaveStudent = async (formData) => {
    try {
      if (editStudentId) {
        await apiCall(`/admin/students/${editStudentId}`, 'PUT', formData);
        toast.success('تم تعديل بيانات الطالب بنجاح');
      } else {
        await apiCall('/admin/students', 'POST', formData);
        toast.success('تمت إضافة الطالب بنجاح');
      }
      setShowStudentModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  };

  const handleUpdateFillCard = async (studentId, action) => {
    try {
      await apiCall(`/admin/students/${studentId}/fill-card`, 'PUT', { action });
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDeleteStudent = (id, name) => {
    setConfirmState({
      open: true,
      title: 'حذف الطالب',
      message: `هل أنت متأكد من حذف "${name}"؟ سيتم حذف جميع بياناته نهائياً.`,
      onConfirm: async () => {
        try { await apiCall(`/admin/students/${id}`, 'DELETE'); toast.success('تم حذف الطالب'); fetchData(); }
        catch (err) { toast.error(err.message); }
        setConfirmState(s => ({ ...s, open: false }));
      }
    });
  };

  // ——— Submissions handler ———
  const handleGradeSubmission = async (subId, formData) => {
    try {
      await apiCall(`/admin/submissions/${subId}/grade`, 'PUT', formData);
      toast.success('تم تقييم التسليم بنجاح');
      fetchData();
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  };

  if (!ready || !user) return null;

  const totalLectures = lectures.length || 1;
  const totalExpected = students.length * totalLectures;
  const avgEng = totalExpected > 0 ? Math.round((submissions.length / totalExpected) * 100) : 0;

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const mobileHeader = (
    <div className={styles.mobileTop}>
      <Image src="/logo.svg" alt="Mental Vision" width={100} height={32} priority />
      <Badge variant="info">لوحة الإدارة</Badge>
    </div>
  );

  return (
    <DashboardLayout navItems={NAV_ITEMS} currentView={currentView} onViewChange={setCurrentView} mobileHeader={mobileHeader}>

      {/* ═══ Dashboard Overview ═══ */}
      {currentView === 'dashboard' && (
        <div className={styles.view} key="dashboard">
          <Header title="لوحة الإدارة" subtitle="متابعة أداء الطلاب والتقييمات" />
          {loading ? (
            <><div className={styles.statsGrid}><SkeletonCard /><SkeletonCard /><SkeletonCard /></div><SkeletonList count={4} /></>
          ) : (
            <>
              <div className={styles.statsGrid}>
                <StatCard label="الطلاب" value={students.length} icon={IconStudents} />
                <StatCard label="التسليمات" value={submissions.length} icon={IconFileText} />
                <StatCard label="التفاعل" value={`${avgEng}%`} icon={IconBarChart} />
              </div>

              <h3 className={styles.sectionTitle}>أحدث التسليمات</h3>
              <div className={styles.listGap}>
                {submissions.length === 0 ? (
                  <EmptyState icon={IconFileText} title="لا توجد تسليمات" description="لم يقم أي طالب بالتسليم بعد." />
                ) : (
                  submissions.slice(0, 5).map(sub => (
                    <Card key={sub.id} padding="sm" className={styles.subItem}>
                      <div className={styles.subInfo}>
                        <strong>{sub.studentName}</strong>
                        <span className={styles.subTask}>{sub.taskTitle}</span>
                        {sub.uploadedFileName && (
                          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'block', marginTop: '2px' }}>
                            الملف: {sub.uploadedFileName}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {sub.fileUrl && sub.fileUrl.startsWith('http') && (
                          <a href={sub.fileUrl} target="_blank" rel="noopener noreferrer" className={styles.subLink} title="عرض الرابط الخارجي">
                            <IconExternalLink size={14} /> رابط
                          </a>
                        )}
                        {sub.uploadedFileUrl && (
                          <a href={sub.uploadedFileUrl} target="_blank" rel="noopener noreferrer" className={styles.subLink} style={{ background: 'var(--green)', color: 'white' }} title="عرض الملف المرفوع">
                            <IconExternalLink size={14} /> ملف
                          </a>
                        )}
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ Students View ═══ */}
      {currentView === 'students' && (
        <div className={styles.view} key="students">
          <Header title="قائمة المتدربين" subtitle="حساب التقييم بناءً على الحضور والتسليم">
            <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
              <div className={styles.searchWrap}>
                <Input icon={IconSearch} placeholder="بحث بالاسم أو اسم المستخدم..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} size="sm" />
              </div>
              {isAdmin && <Button variant="primary" size="md" icon={IconPlus} onClick={openAddStudent}>إضافة طالب</Button>}
            </div>
          </Header>

          <StudentModal
            isOpen={showStudentModal}
            onClose={() => setShowStudentModal(false)}
            editId={editStudentId}
            initialData={studentModalData}
            onSave={handleSaveStudent}
          />
          {loading ? <SkeletonTable rows={5} cols={5} /> : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>الطالب</th>
                    <th>اسم المستخدم</th>
                    <th>الدور</th>
                    <th>التسليمات</th>
                    <th>التقييم</th>
                    <th>الفيل كارد</th>
                    {isAdmin && <th>إجراءات</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 7 : 6} className={styles.emptyCell}>
                        <EmptyState icon={IconStudents} title="لا يوجد طلاب" description={students.length === 0 ? "قم بإضافة أول طالب للمنصة." : "لا توجد نتائج مطابقة لبحثك."} />
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map(s => {
                      const score = s.points || 0;
                      const variant = score >= 100 ? 'success' : score >= 50 ? 'warning' : 'danger';
                      const initials = s.name ? s.name.substring(0, 2) : 'ط';
                      return (
                        <tr key={s.id} className={styles.tableRow}>
                          <td className={styles.nameCell}>
                            <div className={styles.studentInfoCard}>
                              <div className={styles.avatar}>{initials}</div>
                              <span>{s.name}</span>
                            </div>
                          </td>
                          <td className={styles.emailCell} dir="ltr">{s.username}</td>
                          <td><Badge variant="info">طالب</Badge></td>
                          <td>{s.submissionsCount} / {totalLectures}</td>
                          <td><Badge variant={variant}>{score} نقطة</Badge></td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <button onClick={() => handleUpdateFillCard(s.id, 'decrement')} disabled={s.fill_card_count <= 0} style={{ padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--card-bg)' }}>-</button>
                              <span style={{ minWidth: '20px', textAlign: 'center' }}>{s.fill_card_count || 0}</span>
                              <button onClick={() => handleUpdateFillCard(s.id, 'increment')} disabled={s.fill_card_count >= 12} style={{ padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--card-bg)' }}>+</button>
                            </div>
                          </td>
                          {isAdmin && (
                            <td className={styles.actionsCell}>
                              <Button variant="secondary" size="sm" icon={IconEdit} onClick={() => openEditStudent(s)}>تعديل</Button>
                              <Button variant="danger" size="sm" icon={IconTrash} onClick={() => handleDeleteStudent(s.id, s.name)}>حذف</Button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══ Lectures View ═══ */}
      {currentView === 'lectures' && (
        <div className={styles.view} key="lectures">
          <Header title="إدارة المحاضرات" subtitle={`${lectures.length} محاضرة`}>
            {isAdmin && <Button variant="primary" size="md" icon={IconPlus} onClick={openAddLecture}>إضافة محاضرة</Button>}
          </Header>

          {showLectureForm && (
            <LectureForm
              editId={editLectureId} title={formTitle} desc={formDesc} materialUrl={formMaterialUrl}
              onTitleChange={setFormTitle} onDescChange={setFormDesc} onUrlChange={setFormMaterialUrl}
              onSave={handleSaveLecture} onCancel={() => setShowLectureForm(false)}
            />
          )}

          {loading ? <SkeletonList count={3} /> : (
            <div className={styles.listGap}>
              {lectures.length === 0 ? (
                <EmptyState icon={IconLectures} title="لا توجد محاضرات" description="أضف محاضرة جديدة للبدء." actionLabel={isAdmin ? '+ إضافة محاضرة' : undefined} onAction={isAdmin ? openAddLecture : undefined} />
              ) : (
                lectures.map(lec => (
                  <Card key={lec.id} padding="sm" className={styles.adminListItem}>
                    <div className={styles.adminItemInfo}>
                      <h4>{lec.title}</h4>
                      <p>{lec.description || ''}</p>
                      <div className={styles.ratingMeta}>
                        <IconStarFilled size={13} style={{ color: 'var(--amber)' }} />
                        <span>{lec.avgRating || '0.0'}</span>
                        <small>({lec.ratingCount || 0} تقييم)</small>
                      </div>
                    </div>
                    <div className={styles.adminItemActions}>
                      <Button variant="ghost" size="sm" icon={IconEye} onClick={() => openRatings(lec)}>التقييمات</Button>
                      {isAdmin && (
                        <>
                          <Button variant="secondary" size="sm" icon={IconEdit} onClick={() => openEditLecture(lec)}>تعديل</Button>
                          <Button variant="danger" size="sm" icon={IconTrash} onClick={() => handleDeleteLecture(lec.id, lec.title)}>حذف</Button>
                        </>
                      )}
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ Tasks View ═══ */}
      {currentView === 'tasks' && (
        <div className={styles.view} key="tasks">
          <Header title="إدارة التاسكات" subtitle={`${tasks.length} مهمة`}>
            {isAdmin && <Button variant="primary" size="md" icon={IconPlus} onClick={openAddTask}>إضافة مهمة</Button>}
          </Header>

          {showTaskForm && (
            <TaskForm
              editId={editTaskId} title={taskFormTitle} desc={taskFormDesc} taskUrl={taskFormUrl}
              onTitleChange={setTaskFormTitle} onDescChange={setTaskFormDesc} onUrlChange={setTaskFormUrl}
              onSave={handleSaveTask} onCancel={() => setShowTaskForm(false)}
            />
          )}

          {loading ? <SkeletonList count={3} /> : (
            <div className={styles.listGap}>
              {tasks.length === 0 ? (
                <EmptyState icon={IconTasksAlt} title="لا توجد مهام" description="أضف مهمة جديدة للبدء." actionLabel={isAdmin ? '+ إضافة مهمة' : undefined} onAction={isAdmin ? openAddTask : undefined} />
              ) : (
                tasks.map(task => (
                  <Card key={task.id} padding="sm" className={styles.adminListItem}>
                    <div className={styles.adminItemInfo}>
                      <h4>{task.title}</h4>
                      <p>{task.description || ''}</p>
                      <a href={task.taskUrl} target="_blank" rel="noopener noreferrer" className={styles.taskLink}>
                        <IconExternalLink size={13} /> عرض تفاصيل المهمة
                      </a>
                    </div>
                    <div className={styles.adminItemActions}>
                      {isAdmin && (
                        <>
                          <Button variant="secondary" size="sm" icon={IconEdit} onClick={() => openEditTask(task)}>تعديل</Button>
                          <Button variant="danger" size="sm" icon={IconTrash} onClick={() => handleDeleteTask(task.id, task.title)}>حذف</Button>
                        </>
                      )}
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ Attendance View ═══ */}
      {currentView === 'attendance' && (
        <div className={styles.view} key="attendance">
          <AttendancePanel />
        </div>
      )}

      {/* ═══ Submissions View ═══ */}
      {currentView === 'submissions' && (
        <div className={styles.view} key="submissions">
          <Header title="إدارة التسليمات" subtitle={`${submissions.length} تسليم`} />
          
          {loading ? <SkeletonList count={3} /> : (
            <div className={styles.listGap}>
              {submissions.length === 0 ? (
                <EmptyState icon={IconFileText} title="لا توجد تسليمات" description="لم يقم أي طالب بالتسليم بعد." />
              ) : (
                submissions.map(sub => (
                  <SubmissionItem key={sub.id} sub={sub} onGrade={handleGradeSubmission} />
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ Tools View ═══ */}
      {currentView === 'tools' && (
        <div className={styles.view} key="tools">
          <Header title="الأدوات" subtitle="نسخ احتياطي واستعادة البيانات" />
          <BackupPanel />
        </div>
      )}

      {/* Modals */}
      <RatingsModal isOpen={showRatingsModal} onClose={() => setShowRatingsModal(false)} title={ratingsLectureTitle} ratings={lectureRatings} />
      <ConfirmDialog isOpen={confirmState.open} onClose={() => setConfirmState(s => ({ ...s, open: false }))} onConfirm={confirmState.onConfirm} title={confirmState.title} message={confirmState.message} />
    </DashboardLayout>
  );
}

function SubmissionItem({ sub, onGrade }) {
  const [grade, setGrade] = useState(sub.grade ?? '');
  const [feedback, setFeedback] = useState(sub.feedback ?? '');
  const [file, setFile] = useState(null);
  const [deleteFileFlag, setDeleteFileFlag] = useState(false);
  const [saving, setSaving] = useState(false);

  const hasExistingFile = !!sub.feedbackFileUrl && !deleteFileFlag;
  const isChanged = 
    grade !== (sub.grade ?? '') || 
    feedback !== (sub.feedback ?? '') || 
    file !== null || 
    deleteFileFlag;

  const handleSave = async () => {
    const parsedGrade = parseInt(grade);
    if (isNaN(parsedGrade) || parsedGrade < 0 || parsedGrade > 50) {
      alert('التقييم يجب أن يكون بين 0 و 50');
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('grade', parsedGrade);
      formData.append('feedback', feedback);
      if (file) {
        formData.append('file', file);
      }
      if (deleteFileFlag) {
        formData.append('deleteFeedbackFile', 'true');
      }

      await onGrade(sub.id, formData);
      setFile(null);
      setDeleteFileFlag(false);
    } catch (err) {
      // error is already handled
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card padding="sm" className={styles.adminListItem}>
      <div className={styles.adminItemInfo}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <strong style={{ fontSize: '16px', color: 'var(--text-primary)' }}>{sub.studentName}</strong>
          <Badge variant={sub.grade !== null ? 'success' : 'warning'}>
            {sub.grade !== null ? `تم التقييم: ${sub.grade}/50` : 'بانتظار التقييم'}
          </Badge>
        </div>
        <p style={{ margin: '4px 0', color: 'var(--text-secondary)', fontSize: '14px' }}>{sub.taskTitle}</p>
        
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '12px' }}>
          {sub.fileUrl && sub.fileUrl.startsWith('http') && (
            <a href={sub.fileUrl} target="_blank" rel="noopener noreferrer" className={styles.taskLink} style={{ margin: 0, padding: '4px 8px', fontSize: '13px' }}>
              <IconExternalLink size={13} /> عرض الرابط الخارجي
            </a>
          )}
          {sub.uploadedFileUrl && (
            <a href={sub.uploadedFileUrl} target="_blank" rel="noopener noreferrer" className={styles.taskLink} style={{ color: 'var(--green)', margin: 0, padding: '4px 8px', fontSize: '13px' }}>
              <IconExternalLink size={13} /> عرض الملف المرفوع ({sub.uploadedFileName || 'ملف'})
            </a>
          )}
        </div>

        {/* Existing Feedback File Section */}
        {hasExistingFile && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '12px',
            padding: '6px 12px',
            background: 'var(--surface-2)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            fontSize: '13px'
          }}>
            <span style={{ color: 'var(--text-tertiary)' }}>المرفق الحالي:</span>
            <a href={sub.feedbackFileUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-text)', textDecoration: 'underline', fontWeight: '500' }}>
              {sub.feedbackFileName || 'صورة التوضيح'}
            </a>
            <button 
              type="button" 
              onClick={() => setDeleteFileFlag(true)} 
              title="حذف الملف المرفق" 
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--red)',
                cursor: 'pointer',
                padding: '2px',
                display: 'inline-flex',
                alignItems: 'center'
              }}
            >
              <IconTrash size={14} />
            </button>
          </div>
        )}
      </div>

      <div className={styles.adminItemActions} style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        alignItems: 'flex-start',
        background: 'var(--surface-2)',
        padding: '16px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)',
        width: '100%',
        maxWidth: '480px',
        marginTop: '8px'
      }}>
        <div style={{ display: 'flex', gap: '12px', width: '100%', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1', minWidth: '100px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>الدرجة من 50</label>
            <Input
              type="number"
              placeholder="الدرجة"
              min="0"
              max="50"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          
          <div style={{ flex: '2', minWidth: '200px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>ملاحظات للطالب</label>
            <Input
              type="text"
              placeholder="اكتب ملاحظات المعلم هنا..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '12px' }}>
          {/* File Upload Input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="file"
              id={`feedback-file-${sub.id}`}
              onChange={(e) => {
                setFile(e.target.files[0] || null);
                if (e.target.files[0]) {
                  setDeleteFileFlag(false);
                }
              }}
              style={{ display: 'none' }}
              accept="image/*,.pdf"
            />
            <label
              htmlFor={`feedback-file-${sub.id}`}
              style={{
                cursor: 'pointer',
                border: '1px solid var(--border-default)',
                background: 'var(--surface-1)',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                fontWeight: '500'
              }}
            >
              <IconUpload size={14} />
              <span>{file ? 'تغيير الصورة' : 'إرفاق صورة...'}</span>
            </label>
            {file && (
              <span style={{ fontSize: '12px', color: 'var(--text-primary)', maxWidth: '120px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={file.name}>
                {file.name}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {isChanged && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setGrade(sub.grade ?? '');
                  setFeedback(sub.feedback ?? '');
                  setFile(null);
                  setDeleteFileFlag(false);
                }}
                disabled={saving}
              >
                إلغاء
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              disabled={!isChanged || saving}
              onClick={handleSave}
            >
              {saving ? 'جاري الحفظ...' : 'حفظ التقييم'}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
