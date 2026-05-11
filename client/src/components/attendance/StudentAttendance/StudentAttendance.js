'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/contexts/ToastContext';
import { apiCall } from '@/lib/api';
import Header from '@/components/layout/Header/Header';
import EmptyState from '@/components/ui/EmptyState/EmptyState';
import { SkeletonCard, SkeletonList } from '@/components/ui/Skeleton/Skeleton';
import {
  IconClipboardCheck, IconCalendar, IconCheckCircle, IconXCircle, IconClock, IconAward
} from '@/components/icons';
import styles from './StudentAttendance.module.css';

export default function StudentAttendance() {
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAttendance = async () => {
      setLoading(true);
      try {
        const res = await apiCall('/attendance/me');
        setData(res);
      } catch {
        toast.error('خطأ في جلب بيانات الحضور');
      } finally {
        setLoading(false);
      }
    };
    fetchAttendance();
  }, [toast]);

  if (loading) {
    return (
      <div className={styles.attendanceView}>
        <Header title="سجل الحضور" subtitle="تابع حضورك ونقاط الحضور" />
        <div className={styles.statsGrid}><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
        <SkeletonList count={3} />
      </div>
    );
  }

  if (!data || data.totalSessions === 0) {
    return (
      <div className={styles.attendanceView}>
        <Header title="سجل الحضور" subtitle="تابع حضورك ونقاط الحضور" />
        <EmptyState
          icon={IconClipboardCheck}
          title="لا توجد سجلات حضور"
          description="لم يتم تسجيل أي حضور بعد. ستظهر سجلاتك هنا بعد تسجيل الحضور."
        />
      </div>
    );
  }

  // Attendance badge
  const getBadge = (rate) => {
    if (rate >= 90) return { label: 'ممتاز', emoji: '🏆', className: styles.excellent };
    if (rate >= 70) return { label: 'جيد', emoji: '✅', className: styles.good };
    if (rate >= 50) return { label: 'مقبول', emoji: '⚠️', className: styles.warning };
    return { label: 'ضعيف', emoji: '❌', className: styles.poor };
  };

  const badge = getBadge(data.attendanceRate);

  const statusLabel = (status) => {
    switch (status) {
      case 'present': return 'حاضر';
      case 'late': return 'متأخر';
      default: return 'غائب';
    }
  };

  const StatusIcon = ({ status, size = 14 }) => {
    switch (status) {
      case 'present': return <IconCheckCircle size={size} />;
      case 'late': return <IconClock size={size} />;
      default: return <IconXCircle size={size} />;
    }
  };

  return (
    <div className={styles.attendanceView}>
      <Header title="سجل الحضور" subtitle="تابع حضورك ونقاط الحضور" />

      {/* Attendance Badge */}
      <div className={`${styles.attendanceBadge} ${badge.className}`}>
        {badge.emoji} مستوى الحضور: {badge.label}
      </div>

      {/* Stats Grid */}
      <div className={styles.statsGrid}>
        <div className={styles.statBox} style={{ animationDelay: '0ms' }}>
          <span className={styles.statLabel}>الجلسات المحضورة</span>
          <span className={styles.statValue}>{data.attended}</span>
          <span className={styles.statSub}>من {data.totalSessions} جلسة</span>
        </div>
        <div className={`${styles.statBox} ${styles.accent}`} style={{ animationDelay: '60ms' }}>
          <span className={styles.statLabel}>نسبة الحضور</span>
          <span className={styles.statValue}>{data.attendanceRate}%</span>
        </div>
        <div className={styles.statBox} style={{ animationDelay: '120ms' }}>
          <span className={styles.statLabel}>نقاط الحضور</span>
          <span className={styles.statValue}>{data.totalPoints}</span>
          <span className={styles.statSub}>نقطة مكتسبة</span>
        </div>
        <div className={styles.statBox} style={{ animationDelay: '180ms' }}>
          <span className={styles.statLabel}>الغياب</span>
          <span className={styles.statValue}>{data.totalSessions - data.attended}</span>
          <span className={styles.statSub}>جلسة</span>
        </div>
      </div>

      {/* Streak Card */}
      {data.streak > 0 && (
        <div className={styles.streakCard} style={{ animationDelay: '240ms' }}>
          <div className={styles.streakIcon}>🔥</div>
          <div className={styles.streakInfo}>
            <span className={styles.streakValue}>{data.streak} جلسات متتالية</span>
            <span className={styles.streakLabel}>استمر في الحضور للحفاظ على سلسلتك!</span>
          </div>
        </div>
      )}

      {/* History */}
      <h3 className={styles.sectionTitle}>سجل الحضور</h3>
      <div className={styles.historyList}>
        {data.records.map((record, idx) => (
          <div
            key={`${record.sessionId}-${idx}`}
            className={`${styles.historyItem} ${styles[record.status]}`}
            style={{ animationDelay: `${Math.min(idx * 40, 400)}ms` }}
          >
            <div className={styles.historyLeft}>
              <span className={styles.historyTitle}>{record.title}</span>
              <span className={styles.historyDate}>
                <IconCalendar size={12} /> {record.attendanceDate}
              </span>
              {record.notes && (
                <span className={styles.historyNotes}>📝 {record.notes}</span>
              )}
            </div>
            <div className={styles.historyRight}>
              <span className={`${styles.statusBadge} ${styles[record.status]}`}>
                <StatusIcon status={record.status} />
                {statusLabel(record.status)}
              </span>
              {record.awardedPoints > 0 && (
                <span className={styles.pointsBadge}>+{record.awardedPoints} نقطة</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
