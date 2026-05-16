"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { apiCall } from '@/lib/api';
import DashboardLayout from '@/components/layout/DashboardLayout/DashboardLayout';
import Header from '@/components/layout/Header/Header';
import StatCard from '@/components/dashboard/StatCard/StatCard';
import LectureCard from '@/components/lectures/LectureCard/LectureCard';
import LectureDetail from '@/components/lectures/LectureDetail/LectureDetail';
import TaskCard from '@/components/tasks/TaskCard/TaskCard';
import Podium from '@/components/leaderboard/Podium/Podium';
import LeaderboardList from '@/components/leaderboard/LeaderboardList/LeaderboardList';
import Badge from '@/components/ui/Badge/Badge';
import ProgressBar from '@/components/ui/ProgressBar/ProgressBar';
import EmptyState from '@/components/ui/EmptyState/EmptyState';
import StudentAttendance from '@/components/attendance/StudentAttendance/StudentAttendance';
import FillCard from '@/components/ui/FillCard/FillCard';
import { SkeletonCard, SkeletonList } from '@/components/ui/Skeleton/Skeleton';
import { IconLectures, IconTasks, IconTrophy, IconBarChart, IconFileText, IconClipboardCheck, IconAward } from '@/components/icons';
import Image from 'next/image';
import styles from './page.module.css';

const NAV_ITEMS = [
  { id: 'lectures', label: 'المحاضرات', icon: IconLectures, activeIds: ['lectures', 'singleLecture'] },
  { id: 'tasks', label: 'التاسكات', icon: IconTasks },
  { id: 'attendance', label: 'الحضور', icon: IconClipboardCheck },
  { id: 'fillCard', label: 'الفيل كارد', icon: IconAward },
  { id: 'leaderboard', label: 'الليدربورد', icon: IconTrophy },
];

export default function StudentDashboard() {
  const router = useRouter();
  const { user, updateUser, logout, isStudent, ready } = useAuth();
  const { toast } = useToast();

  const [currentView, setCurrentView] = useState('lectures');
  const [lectures, setLectures] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [activeLecture, setActiveLecture] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentRating, setCurrentRating] = useState(0);
  const [currentComment, setCurrentComment] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, lecsRes, subsRes, leadRes, tasksRes] = await Promise.all([
        apiCall('/me'),
        apiCall('/lectures'),
        apiCall('/submissions/me'),
        apiCall('/leaderboard'),
        apiCall('/tasks')
      ]);
      updateUser({ points: meRes.points, fill_card_count: meRes.fill_card_count });
      setLectures(lecsRes);
      setSubmissions(subsRes);
      setLeaderboard(leadRes);
      setTasks(tasksRes);
    } catch {
      toast.error('خطأ في جلب البيانات');
    } finally {
      setLoading(false);
    }
  }, [toast, updateUser]);

  useEffect(() => {
    if (ready && !isStudent) { logout(); return; }
    if (ready && isStudent) fetchData();
  }, [ready, isStudent, logout, fetchData]);

  const openLecture = async (id) => {
    const lec = lectures.find(l => l.id === id);
    if (!lec) { toast.warning('المحاضرة غير متاحة'); return; }
    setActiveLecture(lec);
    setCurrentView('singleLecture');
    try {
      const ratingRes = await apiCall(`/lectures/${id}/my-rating`);
      setCurrentRating(ratingRes.rating || 0);
      setCurrentComment(ratingRes.comment || '');
    } catch {
      setCurrentRating(0);
      setCurrentComment('');
    }
  };

  const handleRating = async () => {
    if (currentRating === 0) { toast.warning('يرجى اختيار تقييم المحاضرة'); return; }
    try {
      await apiCall(`/lectures/${activeLecture.id}/rate`, 'POST', { rating: currentRating, comment: currentComment });
      toast.success('تم حفظ التقييم، شكراً لك!');
    } catch (err) { toast.error(err.message); }
  };

  const handleTaskSubmit = async (taskId, fileUrl) => {
    try {
      const res = await apiCall('/submissions', 'POST', { taskId, fileUrl });
      toast.success(res.message || 'تم التسليم بنجاح');
      const [meRes, subsRes] = await Promise.all([apiCall('/me'), apiCall('/submissions/me')]);
      updateUser({ points: meRes.points });
      setSubmissions(subsRes);
    } catch (error) { toast.error(error.message); }
  };

  const handleTaskCancel = async (taskId) => {
    try {
      const res = await apiCall(`/submissions/${taskId}`, 'DELETE');
      toast.success(res.message || 'تم إلغاء التسليم بنجاح');
      const [meRes, subsRes] = await Promise.all([apiCall('/me'), apiCall('/submissions/me')]);
      updateUser({ points: meRes.points });
      setSubmissions(subsRes);
    } catch (error) { toast.error(error.message); }
  };

  const handleViewChange = (view) => {
    setCurrentView(view);
    setActiveLecture(null);
  };

  if (!ready || !user) return null;

  const totalTasks = tasks.length || 1;
  const completed = submissions.length;
  const progressPercent = Math.min(Math.round((completed / totalTasks) * 100), 100);

  const mobileHeader = (
    <div className={styles.mobileTop}>
      <Image src="/logo.svg" alt="Mental Vision" width={100} height={32} priority />
      <Badge variant="accent">{user.points || 0} نقطة</Badge>
    </div>
  );

  return (
    <DashboardLayout
      navItems={NAV_ITEMS}
      currentView={currentView}
      onViewChange={handleViewChange}
      mobileHeader={mobileHeader}
    >
      {/* ═══ Lectures View ═══ */}
      {currentView === 'lectures' && (
        <div className={styles.view} key="lectures">
          <Header title={`مرحبًا، ${user.name?.split(' ')[0]}!`} subtitle="تابع تقدّمك في المسار التدريبي">
            <Badge variant="accent" className={styles.pointsBadge}>⭐ {user.points || 0} نقطة</Badge>
          </Header>

          {loading ? (
            <>
              <div className={styles.statsGrid}><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
              <SkeletonList count={3} />
            </>
          ) : (
            <>
              <div className={styles.statsGrid}>
                <StatCard label="المحاضرات" value={lectures.length} icon={IconLectures} />
                <StatCard label="المهام المسلّمة" value={completed} icon={IconFileText} />
                <div className={styles.progressCard}>
                  <StatCard label="التقدم" value={`${progressPercent}%`} icon={IconBarChart} />
                  <ProgressBar value={completed} max={totalTasks} />
                </div>
              </div>

              <h3 className={styles.sectionTitle}>جميع المحاضرات</h3>
              <div className={styles.listGap}>
                {lectures.length === 0 ? (
                  <EmptyState icon={IconLectures} title="لا توجد محاضرات" description="لم يتم إضافة محاضرات بعد." />
                ) : (
                  lectures.map(lec => (
                    <LectureCard key={lec.id} lecture={lec} onClick={openLecture} />
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ Single Lecture View ═══ */}
      {currentView === 'singleLecture' && activeLecture && (
        <div className={styles.view} key="singleLecture">
          <LectureDetail
            lecture={activeLecture}
            currentRating={currentRating}
            currentComment={currentComment}
            onRatingChange={setCurrentRating}
            onCommentChange={setCurrentComment}
            onSaveRating={handleRating}
            onBack={() => setCurrentView('lectures')}
          />
        </div>
      )}

      {/* ═══ Tasks View ═══ */}
      {currentView === 'tasks' && (
        <div className={styles.view} key="tasks">
          <Header title="المهام" subtitle="تابع مهامك المعلقة والمنجزة" />
          {loading ? <SkeletonList count={3} /> : (
            <div className={styles.listGap}>
              {tasks.length === 0 ? (
                <EmptyState icon={IconTasks} title="لا توجد مهام" description="لم يتم إضافة مهام بعد." />
              ) : (
                tasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    submission={submissions.find(s => s.taskId === task.id)}
                    onSubmit={handleTaskSubmit}
                    onCancel={handleTaskCancel}
                  />
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ Attendance View ═══ */}
      {currentView === 'attendance' && (
        <div className={styles.view} key="attendance">
          <StudentAttendance />
        </div>
      )}

      {/* ═══ Leaderboard View ═══ */}
      {currentView === 'leaderboard' && (
        <div className={styles.view} key="leaderboard">
          <Header title="الليدربورد" subtitle="تنافس مع زملائك للوصول إلى القمة" />
          {loading ? <SkeletonList count={5} /> : (
            leaderboard.length === 0 ? (
              <EmptyState icon={IconTrophy} title="لا يوجد طلاب بعد" description="لم يتم تسجيل أي طلاب حتى الآن." />
            ) : (
              <>
                <Podium topThree={leaderboard.slice(0, 3)} />
                <LeaderboardList students={leaderboard.slice(3)} startRank={4} />
              </>
            )
          )}
        </div>
      )}

      {/* ═══ Fill Card View ═══ */}
      {currentView === 'fillCard' && (
        <div className={styles.view} key="fillCard">
          <Header title="الفيل كارد" subtitle="متابعة نقاطك الخاصة" />
          <FillCard count={user.fill_card_count || 0} />
        </div>
      )}
    </DashboardLayout>
  );
}
