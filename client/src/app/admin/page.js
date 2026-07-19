"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
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
import SubmissionItem from '@/components/tasks/SubmissionItem/SubmissionItem';
import { SkeletonCard, SkeletonList, SkeletonTable } from '@/components/ui/Skeleton/Skeleton';
import { IconDashboard, IconStudents, IconLectures, IconTasksAlt, IconPlus, IconEdit, IconTrash, IconSearch, IconExternalLink, IconStarFilled, IconEye, IconBarChart, IconFileText, IconSettings, IconClipboardCheck, IconUpload, IconFilter, IconChevronDown, IconChevronUp, IconDownload, IconCheckCircle, IconClock } from '@/components/icons';
import Image from 'next/image';
import styles from './page.module.css';
import StudentSummary from '@/components/students/StudentSummary/StudentSummary';

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
  const [sortBy, setSortBy] = useState('name-asc');

  // Lecture form
  const [showLectureForm, setShowLectureForm] = useState(false);
  const [editLectureId, setEditLectureId] = useState(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formMaterialUrl, setFormMaterialUrl] = useState('');
  const [formVideoUrl, setFormVideoUrl] = useState('');

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

  // Submissions filter & grouping state
  const [subSearch, setSubSearch] = useState('');
  const [subTaskFilter, setSubTaskFilter] = useState('all');
  const [subStatusFilter, setSubStatusFilter] = useState('all');
  const [subGroupBy, setSubGroupBy] = useState('list');
  const [expandedGroups, setExpandedGroups] = useState({});

  // Load submissions preferences from localStorage
  useEffect(() => {
    try {
      const savedTask = localStorage.getItem('lms_sub_task');
      const savedStatus = localStorage.getItem('lms_sub_status');
      const savedGroupBy = localStorage.getItem('lms_sub_groupby');
      if (savedTask) setSubTaskFilter(savedTask);
      if (savedStatus) setSubStatusFilter(savedStatus);
      if (savedGroupBy) setSubGroupBy(savedGroupBy);
    } catch {
      // ignore
    }
  }, []);

  const handleTaskFilterChange = (val) => {
    setSubTaskFilter(val);
    try { localStorage.setItem('lms_sub_task', val); } catch {}
  };
  const handleStatusFilterChange = (val) => {
    setSubStatusFilter(val);
    try { localStorage.setItem('lms_sub_status', val); } catch {}
  };
  const handleGroupByChange = (val) => {
    setSubGroupBy(val);
    try { localStorage.setItem('lms_sub_groupby', val); } catch {}
  };

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: prev[groupId] === undefined ? false : !prev[groupId]
    }));
  };

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
  const openAddLecture = () => { setEditLectureId(null); setFormTitle(''); setFormDesc(''); setFormMaterialUrl(''); setFormVideoUrl(''); setShowLectureForm(true); };
  const openEditLecture = (l) => { setEditLectureId(l.id); setFormTitle(l.title); setFormDesc(l.description || ''); setFormMaterialUrl(l.materialUrl || ''); setFormVideoUrl(l.videoUrl || ''); setShowLectureForm(true); };
  const handleSaveLecture = async (e) => {
    e.preventDefault();
    try {
      if (editLectureId) {
        await apiCall(`/admin/lectures/${editLectureId}`, 'PUT', { title: formTitle, description: formDesc, materialUrl: formMaterialUrl, videoUrl: formVideoUrl });
        toast.success('تم التعديل بنجاح');
      } else {
        await apiCall('/admin/lectures', 'POST', { title: formTitle, description: formDesc, materialUrl: formMaterialUrl, videoUrl: formVideoUrl });
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

  const totalLectures = lectures.length || 1;
  const totalExpected = students.length * totalLectures;
  const avgEng = totalExpected > 0 ? Math.round((submissions.length / totalExpected) * 100) : 0;

  const filteredStudents = useMemo(() => {
    let result = [...students];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.username && s.username.toLowerCase().includes(q))
      );
    }

    switch (sortBy) {
      case 'name-asc':
        result.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
        break;
      case 'name-desc':
        result.sort((a, b) => (b.name || '').localeCompare(a.name || '', 'ar'));
        break;
      case 'points-desc':
        result.sort((a, b) => (b.points || 0) - (a.points || 0));
        break;
      case 'points-asc':
        result.sort((a, b) => (a.points || 0) - (b.points || 0));
        break;
      case 'submissions-desc':
        result.sort((a, b) => (b.submissionsCount || 0) - (a.submissionsCount || 0));
        break;
      case 'submissions-asc':
        result.sort((a, b) => (a.submissionsCount || 0) - (b.submissionsCount || 0));
        break;
      case 'fillcard-desc':
        result.sort((a, b) => (b.fill_card_count || 0) - (a.fill_card_count || 0));
        break;
      case 'fillcard-asc':
        result.sort((a, b) => (a.fill_card_count || 0) - (b.fill_card_count || 0));
        break;
      default:
        break;
    }

    return result;
  }, [students, searchQuery, sortBy]);

  // Filtered submissions logic
  const filteredSubmissions = useMemo(() => {
    let result = [...submissions];

    if (subSearch.trim()) {
      const q = subSearch.toLowerCase().trim();
      result = result.filter(s =>
        (s.studentName && s.studentName.toLowerCase().includes(q)) ||
        (s.taskTitle && s.taskTitle.toLowerCase().includes(q))
      );
    }

    if (subTaskFilter !== 'all') {
      result = result.filter(s => String(s.taskId) === String(subTaskFilter));
    }

    if (subStatusFilter === 'pending') {
      result = result.filter(s => s.grade === null || s.grade === undefined);
    } else if (subStatusFilter === 'graded') {
      result = result.filter(s => s.grade !== null && s.grade !== undefined);
    }

    return result;
  }, [submissions, subSearch, subTaskFilter, subStatusFilter]);

  // Submissions statistics
  const subStats = useMemo(() => {
    const total = submissions.length;
    const pending = submissions.filter(s => s.grade === null || s.grade === undefined).length;
    const graded = total - pending;
    return { total, pending, graded };
  }, [submissions]);

  // Grouping logic (by task or by student)
  const groupedSubmissions = useMemo(() => {
    if (subGroupBy === 'task') {
      const groupsMap = {};
      filteredSubmissions.forEach(sub => {
        const key = sub.taskId || 'unknown';
        if (!groupsMap[key]) {
          groupsMap[key] = {
            id: `task-${key}`,
            title: sub.taskTitle || 'تاسك غير معروف',
            submissions: []
          };
        }
        groupsMap[key].submissions.push(sub);
      });
      return Object.values(groupsMap);
    }

    if (subGroupBy === 'student') {
      const groupsMap = {};
      filteredSubmissions.forEach(sub => {
        const key = sub.userId || 'unknown';
        if (!groupsMap[key]) {
          groupsMap[key] = {
            id: `student-${key}`,
            title: sub.studentName || 'طالب غير معروف',
            submissions: []
          };
        }
        groupsMap[key].submissions.push(sub);
      });
      return Object.values(groupsMap);
    }

    return [];
  }, [filteredSubmissions, subGroupBy]);

  // CSV Export Handler
  const handleExportCSV = () => {
    if (!filteredSubmissions || filteredSubmissions.length === 0) {
      toast.error('لا توجد تسليمات لتصديرها');
      return;
    }

    const headers = ['رقم التسليم', 'اسم الطالب', 'عنوان التاسك', 'الحالة', 'الدرجة', 'الملاحظات', 'رابط التسليم'];
    const rows = filteredSubmissions.map(sub => [
      sub.id,
      `"${(sub.studentName || '').replace(/"/g, '""')}"`,
      `"${(sub.taskTitle || '').replace(/"/g, '""')}"`,
      sub.grade !== null && sub.grade !== undefined ? 'تم التقييم' : 'بانتظار التقييم',
      sub.grade !== null && sub.grade !== undefined ? `${sub.grade}/50` : '-',
      `"${(sub.feedback || '').replace(/"/g, '""')}"`,
      `"${sub.uploadedFileUrl || sub.fileUrl || ''}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `تسليمات_الطلاب_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('تم تصدير ملف التسليمات بنجاح');
  };

  if (!ready || !user) return null;

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
          <StudentSummary />
        </div>
      )}

      {/* ═══ Students View ═══ */}
      {currentView === 'students' && (
        <div className={styles.view} key="students">
          <Header title="قائمة المتدربين" subtitle="حساب التقييم بناءً على الحضور والتسليم">
            <div className={styles.headerActions}>
              <div className={styles.searchWrap}>
                <Input icon={IconSearch} placeholder="بحث بالاسم أو اسم المستخدم..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} size="sm" />
              </div>
              <div className={styles.filterWrap}>
                <IconFilter className={styles.filterIcon} size={14} />
                <select 
                  className={styles.sortSelect} 
                  value={sortBy} 
                  onChange={e => setSortBy(e.target.value)}
                  aria-label="ترتيب الطلاب"
                >
                  <option value="name-asc">الاسم (أ - ي)</option>
                  <option value="name-desc">الاسم (ي - أ)</option>
                  <option value="points-desc">النقاط (الأعلى أولاً)</option>
                  <option value="points-asc">النقاط (الأقل أولاً)</option>
                  <option value="submissions-desc">التسليمات (الأكثر أولاً)</option>
                  <option value="submissions-asc">التسليمات (الأقل أولاً)</option>
                  <option value="fillcard-desc">الفيل كارد (الأكثر أولاً)</option>
                  <option value="fillcard-asc">الفيل كارد (الأقل أولاً)</option>
                </select>
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
                            <div className={styles.fillCardEdit}>
                              <button onClick={() => handleUpdateFillCard(s.id, 'decrement')} disabled={s.fill_card_count <= 0} className={styles.fillCardBtn}>-</button>
                              <span className={styles.fillCardValue}>{s.fill_card_count || 0}</span>
                              <button onClick={() => handleUpdateFillCard(s.id, 'increment')} disabled={s.fill_card_count >= 12} className={styles.fillCardBtn}>+</button>
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
              editId={editLectureId} title={formTitle} desc={formDesc} materialUrl={formMaterialUrl} videoUrl={formVideoUrl}
              onTitleChange={setFormTitle} onDescChange={setFormDesc} onUrlChange={setFormMaterialUrl} onVideoUrlChange={setFormVideoUrl}
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
          <Header title="إدارة التسليمات" subtitle={`${filteredSubmissions.length} تسليم من أصل ${submissions.length}`}>
            <Button variant="secondary" size="md" icon={IconDownload} onClick={handleExportCSV}>
              تصدير CSV
            </Button>
          </Header>

          {/* Submissions Filter Toolbar */}
          <div className={styles.subFilterToolbar}>
            <div className={styles.subFilterRow}>
              {/* Search */}
              <div className={styles.searchWrap}>
                <Input
                  icon={IconSearch}
                  placeholder="بحث باسم الطالب أو التاسك..."
                  value={subSearch}
                  onChange={e => setSubSearch(e.target.value)}
                  size="sm"
                />
              </div>

              {/* Task Dropdown Filter */}
              <div className={styles.filterWrap}>
                <IconFilter className={styles.filterIcon} size={14} />
                <select
                  className={styles.sortSelect}
                  value={subTaskFilter}
                  onChange={e => handleTaskFilterChange(e.target.value)}
                  aria-label="تصفية حسب التاسك"
                >
                  <option value="all">جميع التاسكات ({tasks.length})</option>
                  {tasks.map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>

              {/* Group By Options */}
              <div className={styles.subGroupBtnWrap}>
                <span className={styles.groupLabel}>التجميع:</span>
                <button
                  type="button"
                  className={`${styles.groupBtn} ${subGroupBy === 'list' ? styles.activeGroupBtn : ''}`}
                  onClick={() => handleGroupByChange('list')}
                  title="عرض كقائمة"
                >
                  قائمة
                </button>
                <button
                  type="button"
                  className={`${styles.groupBtn} ${subGroupBy === 'task' ? styles.activeGroupBtn : ''}`}
                  onClick={() => handleGroupByChange('task')}
                  title="تجميع حسب التاسك"
                >
                  حسب التاسك
                </button>
                <button
                  type="button"
                  className={`${styles.groupBtn} ${subGroupBy === 'student' ? styles.activeGroupBtn : ''}`}
                  onClick={() => handleGroupByChange('student')}
                  title="تجميع حسب الطالب"
                >
                  حسب الطالب
                </button>
              </div>
            </div>

            {/* Status Tabs */}
            <div className={styles.subTabsContainer}>
              <button
                type="button"
                className={`${styles.subTab} ${subStatusFilter === 'all' ? styles.activeSubTab : ''}`}
                onClick={() => handleStatusFilterChange('all')}
              >
                الكل ({subStats.total})
              </button>
              <button
                type="button"
                className={`${styles.subTab} ${subStatusFilter === 'pending' ? styles.activeSubTab : ''}`}
                onClick={() => handleStatusFilterChange('pending')}
              >
                <IconClock size={13} />
                <span>بانتظار التقييم ({subStats.pending})</span>
              </button>
              <button
                type="button"
                className={`${styles.subTab} ${subStatusFilter === 'graded' ? styles.activeSubTab : ''}`}
                onClick={() => handleStatusFilterChange('graded')}
              >
                <IconCheckCircle size={13} />
                <span>تم التقييم ({subStats.graded})</span>
              </button>
            </div>
          </div>

          {loading ? <SkeletonList count={3} /> : (
            <>
              {filteredSubmissions.length === 0 ? (
                <EmptyState
                  icon={IconFileText}
                  title="لا توجد تسليمات"
                  description={submissions.length === 0 ? "لم يقم أي طالب بالتسليم بعد." : "لا توجد نتائج مطابقة لخيارات التصفية المختارة."}
                />
              ) : subGroupBy === 'list' ? (
                /* List View */
                <div className={styles.listGap}>
                  {filteredSubmissions.map(sub => (
                    <SubmissionItem key={sub.id} sub={sub} onGrade={handleGradeSubmission} />
                  ))}
                </div>
              ) : (
                /* Grouped Accordion View (By Task or By Student) */
                <div className={styles.groupAccordionList}>
                  {groupedSubmissions.map(group => {
                    const isExpanded = expandedGroups[group.id] !== false; // expanded by default
                    const pendingInGroup = group.submissions.filter(s => s.grade === null || s.grade === undefined).length;
                    const totalInGroup = group.submissions.length;

                    return (
                      <div key={group.id} className={styles.groupCard}>
                        <div
                          className={styles.groupHeader}
                          onClick={() => toggleGroup(group.id)}
                        >
                          <div className={styles.groupTitleWrap}>
                            <h3 className={styles.groupTitle}>{group.title}</h3>
                            <span className={styles.groupSubCount}>
                              {totalInGroup} {totalInGroup === 1 ? 'تسليم' : 'تسليمات'}
                            </span>
                            {pendingInGroup > 0 ? (
                              <Badge variant="warning">
                                {pendingInGroup} بانتظار التقييم
                              </Badge>
                            ) : (
                              <Badge variant="success">
                                تم تقييم الكل
                              </Badge>
                            )}
                          </div>
                          <div className={styles.groupToggleBtn}>
                            {isExpanded ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className={styles.groupContent}>
                            <div className={styles.listGap}>
                              {group.submissions.map(sub => (
                                <SubmissionItem key={sub.id} sub={sub} onGrade={handleGradeSubmission} />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
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


