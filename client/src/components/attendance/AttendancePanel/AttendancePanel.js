'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { apiCall } from '@/lib/api';
import Header from '@/components/layout/Header/Header';
import Button from '@/components/ui/Button/Button';
import Badge from '@/components/ui/Badge/Badge';
import Card from '@/components/ui/Card/Card';
import Input from '@/components/ui/Input/Input';
import EmptyState from '@/components/ui/EmptyState/EmptyState';
import ConfirmDialog from '@/components/ui/ConfirmDialog/ConfirmDialog';
import AttendanceMarking from '@/components/attendance/AttendanceMarking/AttendanceMarking';
import { SkeletonCard, SkeletonList } from '@/components/ui/Skeleton/Skeleton';
import {
  IconPlus, IconEdit, IconTrash, IconCalendar, IconClipboardCheck,
  IconStudents, IconBarChart, IconLockClosed, IconLockOpen, IconClose,
  IconCheckCircle, IconXCircle, IconClock, IconSearch, IconArrowLeft
} from '@/components/icons';
import styles from './AttendancePanel.module.css';

export default function AttendancePanel() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const [sessions, setSessions] = useState([]);
  const [lectures, setLectures] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // View: 'list' | 'marking'
  const [currentSubView, setCurrentSubView] = useState('list');
  const [activeSessionId, setActiveSessionId] = useState(null);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editSession, setEditSession] = useState(null);
  const [formData, setFormData] = useState({
    title: '', description: '', notes: '', lectureId: '', attendanceDate: '', bonusPoints: 10
  });

  // Confirm
  const [confirmState, setConfirmState] = useState({ open: false, title: '', message: '', onConfirm: null });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sessData, lecsData, analyticsData] = await Promise.all([
        apiCall('/admin/attendance/sessions'),
        apiCall('/lectures'),
        apiCall('/admin/attendance/analytics')
      ]);
      setSessions(sessData);
      setLectures(lecsData);
      setAnalytics(analyticsData);
    } catch { toast.error('خطأ في جلب بيانات الحضور'); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ——— Form handlers ———
  const openCreateForm = () => {
    setEditSession(null);
    const today = new Date().toISOString().split('T')[0];
    setFormData({ title: '', description: '', notes: '', lectureId: '', attendanceDate: today, bonusPoints: 10 });
    setShowForm(true);
  };

  const openEditForm = (session) => {
    setEditSession(session);
    setFormData({
      title: session.title,
      description: session.description || '',
      notes: session.notes || '',
      lectureId: session.lectureId || '',
      attendanceDate: session.attendanceDate,
      bonusPoints: session.bonusPoints
    });
    setShowForm(true);
  };

  const handleSaveSession = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) { toast.error('عنوان الجلسة مطلوب'); return; }
    if (!formData.attendanceDate) { toast.error('تاريخ الحضور مطلوب'); return; }

    try {
      if (editSession) {
        await apiCall(`/admin/attendance/sessions/${editSession.id}`, 'PUT', formData);
        toast.success('تم تعديل الجلسة بنجاح');
      } else {
        await apiCall('/admin/attendance/sessions', 'POST', formData);
        toast.success('تم إنشاء جلسة الحضور بنجاح');
      }
      setShowForm(false);
      fetchData();
    } catch (err) { toast.error(err.message); }
  };

  const handleDeleteSession = (session) => {
    setConfirmState({
      open: true,
      title: 'حذف جلسة الحضور',
      message: `هل أنت متأكد من حذف "${session.title}"؟ سيتم استعادة جميع النقاط الممنوحة.`,
      onConfirm: async () => {
        try {
          await apiCall(`/admin/attendance/sessions/${session.id}`, 'DELETE');
          toast.success('تم حذف الجلسة واستعادة النقاط');
          fetchData();
        } catch (err) { toast.error(err.message); }
        setConfirmState(s => ({ ...s, open: false }));
      }
    });
  };

  const handleToggleLock = async (session) => {
    try {
      const res = await apiCall(`/admin/attendance/sessions/${session.id}/lock`, 'PUT');
      toast.success(res.message);
      // Optimistically update session state without full reload (avoids skeleton flash)
      setSessions(prev => prev.map(s =>
        s.id === session.id ? { ...s, isLocked: res.isLocked ? 1 : 0 } : s
      ));
    } catch (err) { toast.error(err.message); }
  };

  const openMarking = (sessionId) => {
    setActiveSessionId(sessionId);
    setCurrentSubView('marking');
  };

  const backToList = () => {
    setCurrentSubView('list');
    setActiveSessionId(null);
    fetchData();
  };

  // ——— Filtered sessions ———
  const filteredSessions = sessions.filter(s =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ——— Marking sub-view ———
  if (currentSubView === 'marking' && activeSessionId) {
    return <AttendanceMarking sessionId={activeSessionId} onBack={backToList} />;
  }

  // ——— Sessions list view ———
  return (
    <div className={styles.panel}>
      <Header title="إدارة الحضور" subtitle={`${sessions.length} جلسة حضور`}>
        <div className={styles.topActions}>
          <div style={{ width: 240 }}>
            <Input icon={IconSearch} placeholder="بحث في الجلسات..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} size="sm" />
          </div>
          {isAdmin && <Button variant="primary" size="md" icon={IconPlus} onClick={openCreateForm}>جلسة جديدة</Button>}
        </div>
      </Header>

      {/* Analytics Cards */}
      {loading ? (
        <div className={styles.analyticsGrid}><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
      ) : analytics && (
        <div className={styles.analyticsGrid}>
          <div className={styles.analyticsCard}>
            <span className={styles.label}>إجمالي الجلسات</span>
            <span className={styles.value}>{analytics.totalSessions}</span>
          </div>
          <div className={`${styles.analyticsCard} ${styles.accent}`}>
            <span className={styles.label}>نسبة الحضور</span>
            <span className={styles.value}>{analytics.attendanceRate}%</span>
          </div>
          <div className={styles.analyticsCard}>
            <span className={styles.label}>الغياب</span>
            <span className={styles.value}>{analytics.absentCount}</span>
            <span className={styles.sub}>سجل غياب</span>
          </div>
          <div className={styles.analyticsCard}>
            <span className={styles.label}>نقاط ممنوحة</span>
            <span className={styles.value}>{analytics.totalAwarded}</span>
            <span className={styles.sub}>نقطة حضور</span>
          </div>
        </div>
      )}

      {/* Sessions List */}
      {loading ? <SkeletonList count={3} /> : (
        <div className={styles.sessionsList}>
          {filteredSessions.length === 0 ? (
            <EmptyState
              icon={IconClipboardCheck}
              title="لا توجد جلسات حضور"
              description={sessions.length === 0 ? "أنشئ أول جلسة حضور للبدء." : "لا توجد نتائج مطابقة لبحثك."}
              actionLabel={isAdmin && sessions.length === 0 ? '+ جلسة جديدة' : undefined}
              onAction={isAdmin && sessions.length === 0 ? openCreateForm : undefined}
            />
          ) : (
            filteredSessions.map((session, idx) => (
              <Card key={session.id} padding="sm" className={styles.sessionCard} style={{ animationDelay: `${idx * 50}ms` }}>
                <div className={styles.sessionInfo} onClick={() => openMarking(session.id)} role="button" tabIndex={0}>
                  <div className={styles.sessionTitle}>
                    {session.title}
                    {session.isLocked ? (
                      <span className={styles.lockBadge}><IconLockClosed size={12} /> مقفلة</span>
                    ) : null}
                  </div>
                  {session.description && <div className={styles.sessionDesc}>{session.description}</div>}
                  <div className={styles.sessionMeta}>
                    <span className={styles.metaItem}><IconCalendar size={13} /> {session.attendanceDate}</span>
                    <span className={styles.metaItem}><IconStudents size={13} /> {session.totalRecords} طالب</span>
                    <span className={styles.metaItem}>⭐ {session.bonusPoints} نقطة</span>
                    {session.lectureTitle && <span className={styles.metaItem}>📖 {session.lectureTitle}</span>}
                  </div>
                  {session.totalRecords > 0 && (
                    <div className={styles.statsRow}>
                      <span className={`${styles.statPill} ${styles.present}`}>
                        <IconCheckCircle size={12} /> {session.presentCount}
                      </span>
                      <span className={`${styles.statPill} ${styles.absent}`}>
                        <IconXCircle size={12} /> {session.absentCount}
                      </span>
                      {session.lateCount > 0 && (
                        <span className={`${styles.statPill} ${styles.late}`}>
                          <IconClock size={12} /> {session.lateCount}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {isAdmin && (
                  <div className={styles.sessionActions}>
                    <Button variant="ghost" size="sm" icon={session.isLocked ? IconLockOpen : IconLockClosed} onClick={(e) => { e.stopPropagation(); handleToggleLock(session); }}>
                      {session.isLocked ? 'فتح' : 'قفل'}
                    </Button>
                    <Button variant="secondary" size="sm" icon={IconEdit} onClick={(e) => { e.stopPropagation(); openEditForm(session); }} disabled={session.isLocked}>
                      تعديل
                    </Button>
                    <Button variant="danger" size="sm" icon={IconTrash} onClick={(e) => { e.stopPropagation(); handleDeleteSession(session); }}>
                      حذف
                    </Button>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      )}

      {/* Analytics Detail */}
      {!loading && analytics && analytics.totalSessions > 0 && (
        <div className={styles.analyticsSection}>
          <h3 className={styles.sectionTitle}>تحليلات الحضور</h3>

          <div className={styles.analyticsColumns}>
            {/* Top Students */}
            {analytics.topStudents?.length > 0 && (
              <div>
                <h4>الأكثر حضوراً</h4>
                <div className={styles.rankList}>
                  {analytics.topStudents.slice(0, 5).map((s, i) => (
                    <div key={s.id} className={styles.rankItem}>
                      <span className={styles.rankNum}>{i + 1}</span>
                      <span className={styles.rankName}>{s.name}</span>
                      <span className={styles.rankStat}>{s.attended}/{s.totalSessions} جلسة</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lowest Students */}
            {analytics.lowestStudents?.length > 0 && (
              <div>
                <h4>الأقل حضوراً</h4>
                <div className={styles.rankList}>
                  {analytics.lowestStudents.slice(0, 5).map((s, i) => (
                    <div key={s.id} className={styles.rankItem}>
                      <span className={styles.rankNum}>{i + 1}</span>
                      <span className={styles.rankName}>{s.name}</span>
                      <span className={styles.rankStat}>{s.attended}/{s.totalSessions} جلسة</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Trends */}
          {analytics.trends?.length > 0 && (
            <div style={{ marginTop: 'var(--space-6)' }}>
              <h4>آخر الجلسات</h4>
              <div className={styles.trendList}>
                {analytics.trends.map(t => {
                  const rate = t.total > 0 ? Math.round((t.present / t.total) * 100) : 0;
                  return (
                    <div key={t.id} className={styles.trendItem}>
                      <span className={styles.trendTitle}>{t.title}</span>
                      <div className={styles.trendBar}>
                        <div className={`${styles.trendBarFill} ${styles.green}`} style={{ width: `${Math.max(rate, 5)}px` }} />
                        <div className={`${styles.trendBarFill} ${styles.red}`} style={{ width: `${Math.max(100 - rate, 5)}px` }} />
                      </div>
                      <span className={styles.trendPercent}>{rate}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div className={styles.formOverlay} onClick={() => setShowForm(false)}>
          <div className={styles.formCard} onClick={e => e.stopPropagation()}>
            <div className={styles.formHeader}>
              <h3>{editSession ? 'تعديل جلسة الحضور' : 'إنشاء جلسة حضور جديدة'}</h3>
              <Button variant="ghost" size="sm" icon={IconClose} onClick={() => setShowForm(false)} />
            </div>
            <form onSubmit={handleSaveSession}>
              <div className={styles.formBody}>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>عنوان الجلسة *</label>
                  <Input
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    placeholder="مثال: حضور المحاضرة الأولى"
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>الوصف (اختياري)</label>
                  <Input
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="وصف مختصر للجلسة"
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>ملاحظات (اختياري)</label>
                  <textarea
                    className={styles.notesField}
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="مثال: يوم ورشة عمل، حضور متأخر مسموح..."
                  />
                </div>

                <div className={styles.fieldRow}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>تاريخ الحضور *</label>
                    <Input
                      type="date"
                      value={formData.attendanceDate}
                      onChange={e => setFormData({ ...formData, attendanceDate: e.target.value })}
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>النقاط الإضافية</label>
                    <Input
                      type="number"
                      value={formData.bonusPoints}
                      onChange={e => setFormData({ ...formData, bonusPoints: parseInt(e.target.value) || 0 })}
                      min="0"
                      max="1000"
                    />
                  </div>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>ربط بمحاضرة (اختياري)</label>
                  <select
                    className={styles.selectField}
                    value={formData.lectureId}
                    onChange={e => setFormData({ ...formData, lectureId: e.target.value })}
                  >
                    <option value="">— بدون ربط —</option>
                    {lectures.map(l => (
                      <option key={l.id} value={l.id}>{l.title}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className={styles.formFooter}>
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>إلغاء</Button>
                <Button type="submit" variant="primary">{editSession ? 'حفظ التعديلات' : 'إنشاء الجلسة'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmState.open}
        onClose={() => setConfirmState(s => ({ ...s, open: false }))}
        onConfirm={confirmState.onConfirm}
        title={confirmState.title}
        message={confirmState.message}
      />
    </div>
  );
}
