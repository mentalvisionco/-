'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { apiCall } from '@/lib/api';
import Button from '@/components/ui/Button/Button';
import Input from '@/components/ui/Input/Input';
import { SkeletonList } from '@/components/ui/Skeleton/Skeleton';
import {
  IconArrowLeft, IconSearch, IconCheckCircle, IconXCircle,
  IconClock, IconCalendar, IconStudents, IconLockClosed, IconCheck
} from '@/components/icons';
import styles from './AttendanceMarking.module.css';

export default function AttendanceMarking({ sessionId, onBack }) {
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const [session, setSession] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Local attendance state: { [studentId]: status }
  const [attendance, setAttendance] = useState({});
  // Track original state for dirty detection
  const [originalAttendance, setOriginalAttendance] = useState({});

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiCall(`/admin/attendance/sessions/${sessionId}/records`);
      setSession(data.session);
      setStudents(data.students);

      // Build attendance map from existing records
      const map = {};
      for (const s of data.students) {
        map[s.id] = s.status || 'absent';
      }
      setAttendance(map);
      setOriginalAttendance({ ...map });
    } catch (err) {
      toast.error('خطأ في جلب بيانات الجلسة');
    } finally {
      setLoading(false);
    }
  }, [sessionId, toast]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  // ——— Status changes ———
  const setStatus = (studentId, status) => {
    if (session?.isLocked && !isAdmin) return;
    if (session?.isLocked) return;
    setAttendance(prev => ({ ...prev, [studentId]: status }));
  };

  const markAllPresent = () => {
    if (session?.isLocked) return;
    const map = {};
    students.forEach(s => { map[s.id] = 'present'; });
    setAttendance(map);
  };

  const markAllAbsent = () => {
    if (session?.isLocked) return;
    const map = {};
    students.forEach(s => { map[s.id] = 'absent'; });
    setAttendance(map);
  };

  // ——— Save ———
  const handleSave = async () => {
    setSaving(true);
    try {
      const records = Object.entries(attendance).map(([studentId, status]) => ({
        studentId: parseInt(studentId),
        status
      }));
      await apiCall(`/admin/attendance/sessions/${sessionId}/records`, 'POST', { records });
      toast.success('تم حفظ الحضور بنجاح');
      setOriginalAttendance({ ...attendance });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ——— Computed ———
  const filteredStudents = useMemo(() => {
    return students.filter(s =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.username.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [students, searchQuery]);

  const counts = useMemo(() => {
    const values = Object.values(attendance);
    return {
      present: values.filter(v => v === 'present').length,
      absent: values.filter(v => v === 'absent').length,
      late: values.filter(v => v === 'late').length,
      total: values.length
    };
  }, [attendance]);

  const isDirty = useMemo(() => {
    return JSON.stringify(attendance) !== JSON.stringify(originalAttendance);
  }, [attendance, originalAttendance]);

  if (loading) {
    return (
      <div className={styles.markingView}>
        <Button variant="ghost" size="sm" icon={IconArrowLeft} onClick={onBack}>العودة للجلسات</Button>
        <SkeletonList count={5} />
      </div>
    );
  }

  if (!session) {
    return (
      <div className={styles.markingView}>
        <Button variant="ghost" size="sm" icon={IconArrowLeft} onClick={onBack}>العودة للجلسات</Button>
        <p>الجلسة غير موجودة</p>
      </div>
    );
  }

  return (
    <div className={styles.markingView}>
      {/* Back Button */}
      <Button variant="ghost" size="sm" icon={IconArrowLeft} onClick={onBack}>العودة للجلسات</Button>

      {/* Session Header */}
      <div className={styles.sessionHeader}>
        <div className={styles.sessionHeaderTop}>
          <h2>{session.title}</h2>
          {session.isLocked && (
            <span className={styles.lockedBanner} style={{ padding: '4px 12px', fontSize: 'var(--font-sm)' }}>
              <IconLockClosed size={14} /> مقفلة
            </span>
          )}
        </div>
        <div className={styles.sessionHeaderMeta}>
          <span className={styles.metaChip}><IconCalendar size={13} /> {session.attendanceDate}</span>
          <span className={styles.metaChip}><IconStudents size={13} /> {students.length} طالب</span>
          <span className={styles.metaChip}>⭐ حضور: {session.bonusPoints} | تأخير: {session.latePoints !== undefined ? session.latePoints : 5}</span>
        </div>
        {session.notes && (
          <div className={styles.sessionNotes}>📝 {session.notes}</div>
        )}
      </div>

      {/* Locked Banner */}
      {session.isLocked && (
        <div className={styles.lockedBanner}>
          <IconLockClosed size={18} />
          هذه الجلسة مقفلة — لا يمكن تعديل الحضور إلا بعد فتحها من صفحة الجلسات.
        </div>
      )}

      {/* Controls Bar */}
      <div className={styles.controlsBar}>
        <div className={styles.controlsLeft}>
          <div className={styles.searchWrap}>
            <Input icon={IconSearch} placeholder="بحث عن طالب..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} size="sm" />
          </div>
          {isAdmin && !session.isLocked && (
            <div className={styles.bulkActions}>
              <Button variant="secondary" size="sm" icon={IconCheckCircle} onClick={markAllPresent}>الكل حاضر</Button>
              <Button variant="secondary" size="sm" icon={IconXCircle} onClick={markAllAbsent}>الكل غائب</Button>
            </div>
          )}
        </div>
        <div className={styles.counters}>
          <span className={`${styles.counter} ${styles.present}`}><IconCheckCircle size={14} /> {counts.present}</span>
          <span className={`${styles.counter} ${styles.absent}`}><IconXCircle size={14} /> {counts.absent}</span>
          {counts.late > 0 && <span className={`${styles.counter} ${styles.late}`}><IconClock size={14} /> {counts.late}</span>}
          <span className={`${styles.counter} ${styles.total}`}>{counts.total}</span>
        </div>
      </div>

      {/* Student List */}
      <div className={styles.studentList}>
        {filteredStudents.map((student, idx) => {
          const status = attendance[student.id] || 'absent';
          const initials = student.name ? student.name.substring(0, 2) : 'ط';
          return (
            <div
              key={student.id}
              className={`${styles.studentRow} ${status === 'present' ? styles.statusPresent : status === 'late' ? styles.statusLate : styles.statusAbsent}`}
              style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
            >
              <div className={styles.studentInfo}>
                <div className={styles.avatar}>{initials}</div>
                <div>
                  <div className={styles.studentName}>{student.name}</div>
                  <div className={styles.studentEmail} dir="ltr">{student.username}</div>
                </div>
              </div>

              <div className={styles.statusToggle}>
                <button
                  type="button"
                  className={`${styles.toggleBtn} ${status === 'present' ? styles.activePresent : ''}`}
                  onClick={() => setStatus(student.id, 'present')}
                  disabled={session.isLocked}
                  aria-label="حاضر"
                >
                  <IconCheckCircle size={15} /> حاضر
                </button>
                <button
                  type="button"
                  className={`${styles.toggleBtn} ${status === 'late' ? styles.activeLate : ''}`}
                  onClick={() => setStatus(student.id, 'late')}
                  disabled={session.isLocked}
                  aria-label="متأخر"
                >
                  <IconClock size={15} /> متأخر
                </button>
                <button
                  type="button"
                  className={`${styles.toggleBtn} ${status === 'absent' ? styles.activeAbsent : ''}`}
                  onClick={() => setStatus(student.id, 'absent')}
                  disabled={session.isLocked}
                  aria-label="غائب"
                >
                  <IconXCircle size={15} /> غائب
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Save Footer (sticky) */}
      {isAdmin && !session.isLocked && (
        <div className={styles.saveFooter}>
          <div className={styles.saveInfo}>
            {isDirty
              ? `تم تعديل ${Object.keys(attendance).length} سجل — يرجى الحفظ`
              : 'لا توجد تغييرات معلقة'
            }
          </div>
          <div className={styles.saveActions}>
            <Button variant="ghost" onClick={onBack}>إلغاء</Button>
            <Button variant="primary" icon={IconCheck} onClick={handleSave} disabled={saving || !isDirty}>
              {saving ? 'جاري الحفظ...' : 'حفظ الحضور'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
