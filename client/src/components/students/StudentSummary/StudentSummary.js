'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { apiCall } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import StatCard from '@/components/dashboard/StatCard/StatCard';
import Button from '@/components/ui/Button/Button';
import Input from '@/components/ui/Input/Input';
import Badge from '@/components/ui/Badge/Badge';
import EmptyState from '@/components/ui/EmptyState/EmptyState';
import { SkeletonCard, SkeletonTable } from '@/components/ui/Skeleton/Skeleton';
import {
  IconSearch, IconFileText, IconFilter, IconStudents,
  IconBarChart, IconClipboardCheck, IconStarFilled,
  IconChevronDown, IconChevronLeft, IconChevronRight
} from '@/components/icons';
import styles from './StudentSummary.module.css';

export default function StudentSummary() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [data, setData] = useState({
    students: [],
    sessions: [],
    tasks: [],
    summary: {
      totalStudents: 0,
      avgAttendance: 0,
      avgSubmission: 0,
      avgGrade: 0,
      strugglingCount: 0,
      totalAbsences: 0,
      totalMissingTasks: 0,
      totalPendingGrades: 0,
      topStudent: null,
      lowestStudent: null
    }
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('name-asc');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Custom react-state driven tooltips to prevent mobile issues
  const [activeTooltip, setActiveTooltip] = useState(null); // { id, text }
  const containerRef = useRef(null);

  // Accordion state for mobile view
  const [expandedStudentId, setExpandedStudentId] = useState(null);

  // Fetch summary payload
  const fetchSummary = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await apiCall('/admin/dashboard/summary');
      setData(res);
    } catch (err) {
      setError(true);
      toast.error('حدث خطأ في تحميل ملخص البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  // Listen to document clicks to dismiss tooltips when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      // Don't close if clicking inside the tooltip trigger or the tooltip itself
      if (e.target.closest(`.${styles.tooltipWrapper}`) || e.target.closest(`.${styles.tooltipCard}`)) {
        return;
      }
      setActiveTooltip(null);
    };
    document.addEventListener('click', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, []);

  // Reset pagination on filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus, sortBy]);

  // Handle tooltip click / toggle
  const toggleTooltip = (e, id, text) => {
    e.stopPropagation();
    if (activeTooltip && activeTooltip.id === id) {
      setActiveTooltip(null);
    } else {
      setActiveTooltip({ id, text });
    }
  };

  // Search, Filter, and Sort student list using useMemo
  const filteredStudents = useMemo(() => {
    let result = [...data.students];

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.username && s.username.toLowerCase().includes(q))
      );
    }

    // Performance rules filter
    if (filterStatus !== 'all') {
      result = result.filter(s => {
        if (filterStatus === 'excelled') return s.performanceStatus === 'excelled';
        if (filterStatus === 'struggling') return s.performanceStatus === 'struggling';
        if (filterStatus === 'pending_grade') return s.studentPendingCount > 0;
        if (filterStatus === 'missing_tasks') return s.missingCount > 0;
        return true;
      });
    }

    // Sort
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
      case 'attendance-desc':
        result.sort((a, b) => b.attendanceRate - a.attendanceRate);
        break;
      case 'attendance-asc':
        result.sort((a, b) => a.attendanceRate - b.attendanceRate);
        break;
      case 'tasks-desc':
        result.sort((a, b) => b.submissionRate - a.submissionRate);
        break;
      case 'tasks-asc':
        result.sort((a, b) => a.submissionRate - b.submissionRate);
        break;
      case 'grade-desc':
        result.sort((a, b) => (b.averageGrade || 0) - (a.averageGrade || 0));
        break;
      default:
        break;
    }

    return result;
  }, [data.students, searchQuery, filterStatus, sortBy]);

  // Paginated students slice
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, currentPage, pageSize]);

  // Total pages calculation
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  }, [filteredStudents, pageSize]);

  // Complete Excel-compatible CSV export
  const exportToCSV = () => {
    try {
      // Base headers
      const headers = [
        'اسم الطالب',
        'اسم المستخدم',
        'النقاط الإجمالية',
        'كروت الفيل كارد',
        'نسبة الحضور (%)',
        'حضور',
        'تأخير',
        'غياب',
        'نسبة التسليم (%)',
        'تاسكات مسلمة',
        'تاسكات مفقودة',
        'تاسكات معلقة',
        'متوسط التقييم'
      ];

      // Add dynamic headers for sessions and tasks
      data.sessions.forEach((sess, idx) => {
        headers.push(`محاضرة ${idx + 1}: ${sess.title} (${sess.attendanceDate})`);
      });

      data.tasks.forEach((task, idx) => {
        headers.push(`تاسك ${idx + 1}: ${task.title}`);
      });

      const csvRows = [headers.join(',')];

      data.students.forEach(s => {
        const row = [
          `"${s.name || ''}"`,
          `"${s.username || ''}"`,
          s.points || 0,
          s.fill_card_count || 0,
          `"${s.attendanceRate}%"`,
          s.presentCount,
          s.lateCount,
          s.absentCount,
          `"${s.submissionRate}%"`,
          s.submittedCount,
          s.missingCount,
          s.studentPendingCount,
          s.averageGrade !== null ? s.averageGrade : '—'
        ];

        // Append session statuses
        data.sessions.forEach(sess => {
          const statusVal = s.attendance[sess.id];
          let statusText = 'غير مسجل';
          if (statusVal === 1) statusText = 'حضور';
          else if (statusVal === 2) statusText = 'تأخير';
          else if (statusVal === 0) statusText = 'غياب';
          row.push(`"${statusText}"`);
        });

        // Append task statuses
        data.tasks.forEach(task => {
          const taskObj = s.tasks[task.id] || { status: 3, grade: null };
          let statusText = 'لم يسلم';
          if (taskObj.status === 1) statusText = `درجة: ${taskObj.grade}/10`;
          else if (taskObj.status === 2) statusText = 'قيد التقييم';
          row.push(`"${statusText}"`);
        });

        csvRows.push(row.join(','));
      });

      // UTF-8 BOM prefix
      const csvString = '\uFEFF' + csvRows.join('\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `تقرير_متابعة_الطلاب_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('تم تصدير التقرير بنجاح');
    } catch (err) {
      toast.error('حدث خطأ أثناء تصدير التقرير');
    }
  };

  // Toggle Accordion on mobile click
  const toggleAccordion = (id) => {
    setExpandedStudentId(expandedStudentId === id ? null : id);
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.statsGrid}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonTable rows={8} cols={6} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorTitle}>خطأ في جلب البيانات</div>
        <p className={styles.errorMessage}>تعذر تحميل ملخص لوحة التحكم في الوقت الحالي.</p>
        <Button variant="danger" size="md" onClick={fetchSummary}>إعادة المحاولة</Button>
      </div>
    );
  }

  const { summary } = data;

  return (
    <div className={styles.container} ref={containerRef}>
      {/* 10 Dashboard Summary Cards */}
      <div className={styles.statsGrid}>
        <StatCard label="إجمالي الطلاب" value={summary.totalStudents} icon={IconStudents} />
        <StatCard label="نسبة الحضور" value={`${summary.avgAttendance}%`} icon={IconClipboardCheck} />
        <StatCard label="إنجاز التاسكات" value={`${summary.avgSubmission}%`} icon={IconBarChart} />
        <StatCard label="متوسط التقييمات" value={summary.avgGrade > 0 ? `${summary.avgGrade} / 10` : '0'} icon={IconStarFilled} />
        <StatCard label="يحتاجون متابعة" value={summary.strugglingCount} icon={IconStudents} />
        <StatCard label="إجمالي الغيابات" value={summary.totalAbsences} icon={IconClipboardCheck} />
        <StatCard label="تاسكات مفقودة" value={summary.totalMissingTasks} icon={IconBarChart} />
        <StatCard label="تاسكات معلقة" value={summary.totalPendingGrades} icon={IconFileText} />
        <StatCard 
          label="أفضل طالب" 
          value={summary.topStudent ? `${summary.topStudent.points} ن` : '—'} 
          subtitle={summary.topStudent ? summary.topStudent.name : ''} 
          icon={IconStarFilled} 
        />
        <StatCard 
          label="أقل طالب" 
          value={summary.lowestStudent ? `${summary.lowestStudent.points} ن` : '—'} 
          subtitle={summary.lowestStudent ? summary.lowestStudent.name : ''} 
          icon={IconStudents} 
        />
      </div>

      {/* Header section with Export Button */}
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>متابعة الطلاب التفصيلية</h3>
        <Button variant="secondary" size="sm" icon={IconFileText} onClick={exportToCSV}>
          تصدير التقرير (Excel)
        </Button>
      </div>

      {/* Search and Filters */}
      <div className={styles.actionsRow}>
        <div className={styles.filterGroup}>
          <div className={styles.searchWrap}>
            <Input
              icon={IconSearch}
              placeholder="بحث بالاسم أو اسم المستخدم..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              size="sm"
            />
          </div>

          <div className={styles.filterWrap}>
            <IconFilter className={styles.filterIcon} size={13} />
            <select
              className={styles.selectInput}
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              aria-label="فلترة الطلاب حسب الحالة"
            >
              <option value="all">كل الطلاب</option>
              <option value="excelled">المتفوقون</option>
              <option value="struggling">يحتاجون متابعة (حضور أو تاسكات &lt; 70%)</option>
              <option value="missing_tasks">لديهم تاسكات غير مسلّمة</option>
              <option value="pending_grade">لديهم تاسكات معلقة للتقييم</option>
            </select>
          </div>

          <div className={styles.filterWrap}>
            <IconFilter className={styles.filterIcon} size={13} />
            <select
              className={styles.selectInput}
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              aria-label="ترتيب الطلاب"
            >
              <option value="name-asc">الاسم (أ - ي)</option>
              <option value="name-desc">الاسم (ي - أ)</option>
              <option value="points-desc">النقاط (الأعلى أولاً)</option>
              <option value="attendance-desc">الحضور (الأعلى أولاً)</option>
              <option value="attendance-asc">الحضور (الأقل أولاً)</option>
              <option value="tasks-desc">التسليمات (الأعلى أولاً)</option>
              <option value="tasks-asc">التسليمات (الأقل أولاً)</option>
              <option value="grade-desc">التقييم (الأعلى أولاً)</option>
            </select>
          </div>
        </div>
      </div>

      {/* =========================================================
          DESKTOP VIEW: Data Table (Scrollable & Sticky columns)
          ========================================================= */}
      <div className={styles.desktopView}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.stickyColStudent}>الطالب</th>
                <th className={styles.stickyColPoints}>النقاط</th>
                <th>كروت الفيل</th>
                <th>نسبة الحضور</th>
                <th>المحاضرات</th>
                <th>نسبة التسليم</th>
                <th>التاسكات</th>
                <th>متوسط التقييم</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {paginatedStudents.length === 0 ? (
                <tr>
                  <td colSpan={9} className={styles.emptyCell}>
                    <EmptyState
                      icon={IconStudents}
                      title="لا يوجد طلاب"
                      description={data.students.length === 0 ? "لا يوجد طلاب مسجلين في المنصة." : "لا توجد نتائج مطابقة لبحثك أو فلترتك الحالية."}
                    />
                  </td>
                </tr>
              ) : (
                paginatedStudents.map(student => {
                  const initLetters = student.name ? student.name.substring(0, 2) : 'ط';
                  return (
                    <tr key={student.id}>
                      {/* Sticky Student info cell */}
                      <td className={styles.stickyColStudent}>
                        <div className={styles.studentInfoCard}>
                          <div className={styles.avatar}>{initLetters}</div>
                          <div>
                            <span className={styles.nameText} title={student.name}>{student.name}</span>
                            <span className={styles.usernameText} title={student.username}>{student.username}</span>
                          </div>
                        </div>
                      </td>

                      {/* Sticky Points cell */}
                      <td className={styles.stickyColPoints}>
                        <Badge variant={student.points >= 100 ? 'success' : student.points >= 50 ? 'warning' : 'danger'}>
                          {student.points || 0} نقطة
                        </Badge>
                      </td>

                      {/* Fill Cards Count */}
                      <td>
                        <Badge variant="info">
                          {student.fill_card_count || 0} كارت
                        </Badge>
                      </td>

                      {/* Attendance Percentage progress */}
                      <td>
                        <div className={styles.progressContainer}>
                          <div className={styles.progressLabel}>
                            <strong>{student.attendanceRate}%</strong>
                            <span>({student.presentCount + student.lateCount}/{data.sessions.length})</span>
                          </div>
                          <div className={styles.progressBarBg}>
                            <div
                              className={styles.progressBarFill}
                              style={{
                                width: `${student.attendanceRate}%`,
                                backgroundColor: student.attendanceRate >= 80 ? 'var(--accent)' : student.attendanceRate >= 60 ? 'var(--amber)' : 'var(--danger)'
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Attendance Matrix Circles */}
                      <td>
                        <div className={styles.statusIndicatorGrid}>
                          {data.sessions.map((session) => {
                            const status = student.attendance[session.id] !== undefined ? student.attendance[session.id] : 3;
                            let statusClass = styles.noRecord;
                            let symbol = '—';
                            let statusName = 'غير مسجل';

                            if (status === 1) {
                              statusClass = styles.present;
                              symbol = '✓';
                              statusName = 'حضور';
                            } else if (status === 2) {
                              statusClass = styles.late;
                              symbol = '!';
                              statusName = 'تأخير';
                            } else if (status === 0) {
                              statusClass = styles.absent;
                              symbol = '✖';
                              statusName = 'غياب';
                            }

                            const tooltipId = `att-${student.id}-${session.id}`;
                            const tooltipText = `${session.title} (${session.attendanceDate}) - ${statusName}`;

                            return (
                              <div
                                key={session.id}
                                className={styles.tooltipWrapper}
                                onClick={(e) => toggleTooltip(e, tooltipId, tooltipText)}
                                onMouseEnter={(e) => setActiveTooltip({ id: tooltipId, text: tooltipText })}
                                onMouseLeave={() => setActiveTooltip(null)}
                              >
                                <span className={`${styles.statusCircle} ${statusClass}`}>
                                  {symbol}
                                </span>
                                {activeTooltip && activeTooltip.id === tooltipId && (
                                  <div className={styles.tooltipCard}>{activeTooltip.text}</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </td>

                      {/* Tasks Submission Percentage progress */}
                      <td>
                        <div className={styles.progressContainer}>
                          <div className={styles.progressLabel}>
                            <strong>{student.submissionRate}%</strong>
                            <span>({student.submittedCount}/{data.tasks.length})</span>
                          </div>
                          <div className={styles.progressBarBg}>
                            <div
                              className={styles.progressBarFill}
                              style={{
                                width: `${student.submissionRate}%`,
                                backgroundColor: student.submissionRate >= 80 ? 'var(--accent)' : student.submissionRate >= 50 ? 'var(--amber)' : 'var(--danger)'
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Tasks Matrix Circles */}
                      <td>
                        <div className={styles.statusIndicatorGrid}>
                          {data.tasks.map((task) => {
                            const taskObj = student.tasks[task.id] || { status: 3, grade: null };
                            let statusClass = styles.notSubmitted;
                            let symbol = '✖';
                            let tooltipText = `${task.title} - لم يتم التسليم`;

                            if (taskObj.status === 1) {
                              statusClass = styles.submittedGraded;
                              symbol = taskObj.grade;
                              tooltipText = `${task.title} - مقيّم: ${taskObj.grade}/10`;
                            } else if (taskObj.status === 2) {
                              statusClass = styles.submittedPending;
                              symbol = '!';
                              tooltipText = `${task.title} - قيد التقييم`;
                            }

                            const tooltipId = `task-${student.id}-${task.id}`;

                            return (
                              <div
                                key={task.id}
                                className={styles.tooltipWrapper}
                                onClick={(e) => toggleTooltip(e, tooltipId, tooltipText)}
                                onMouseEnter={(e) => setActiveTooltip({ id: tooltipId, text: tooltipText })}
                                onMouseLeave={() => setActiveTooltip(null)}
                              >
                                <span className={`${styles.statusCircle} ${statusClass}`}>
                                  {symbol}
                                </span>
                                {activeTooltip && activeTooltip.id === tooltipId && (
                                  <div className={styles.tooltipCard}>{activeTooltip.text}</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </td>

                      {/* Average Grade */}
                      <td>
                        {student.averageGrade !== null ? (
                          <Badge variant="success">
                            {student.averageGrade} / 10
                          </Badge>
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                        )}
                      </td>

                      {/* Performance Status tag */}
                      <td>
                        {student.performanceStatus === 'excelled' && <Badge variant="success">متفوق</Badge>}
                        {student.performanceStatus === 'struggling' && <Badge variant="danger">يحتاج متابعة</Badge>}
                        {student.performanceStatus === 'pending_grade' && <Badge variant="warning">تقييم معلق</Badge>}
                        {student.performanceStatus === 'missing_tasks' && <Badge variant="danger">تاسك غائب</Badge>}
                        {student.performanceStatus === 'active' && <Badge variant="info">نشط</Badge>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================
          MOBILE VIEW: Expandable Accordion cards
          ========================================================= */}
      <div className={styles.mobileView}>
        {paginatedStudents.length === 0 ? (
          <EmptyState
            icon={IconStudents}
            title="لا يوجد طلاب"
            description={data.students.length === 0 ? "لا يوجد طلاب مسجلين في المنصة." : "لا توجد نتائج مطابقة لبحثك أو فلترتك الحالية."}
          />
        ) : (
          paginatedStudents.map(student => {
            const initLetters = student.name ? student.name.substring(0, 2) : 'ط';
            const isExpanded = expandedStudentId === student.id;

            return (
              <div className={styles.mobileCard} key={student.id}>
                {/* Accordion Header */}
                <div className={styles.mobileCardHeader} onClick={() => toggleAccordion(student.id)}>
                  <div className={styles.mobileStudentSummary}>
                    <div className={styles.avatar}>{initLetters}</div>
                    <div style={{ minWidth: 0 }}>
                      <span className={styles.nameText}>{student.name}</span>
                      <span className={styles.usernameText}>{student.username}</span>
                    </div>
                  </div>
                  <div className={styles.mobileStatsRight}>
                    <Badge variant={student.points >= 100 ? 'success' : student.points >= 50 ? 'warning' : 'danger'}>
                      {student.points || 0} ن
                    </Badge>
                    <IconChevronDown
                      size={18}
                      className={`${styles.chevronIcon} ${isExpanded ? styles.chevronRotated : ''}`}
                    />
                  </div>
                </div>

                {/* Collapsible Accordion Body */}
                {isExpanded && (
                  <div className={styles.mobileCardBody}>
                    {/* Performance Tags */}
                    <div className={styles.mobilePerformanceTags}>
                      {student.performanceStatus === 'excelled' && <Badge variant="success">متفوق</Badge>}
                      {student.performanceStatus === 'struggling' && <Badge variant="danger">يحتاج متابعة</Badge>}
                      {student.performanceStatus === 'pending_grade' && <Badge variant="warning">تقييم معلق</Badge>}
                      {student.performanceStatus === 'missing_tasks' && <Badge variant="danger">تاسك غائب</Badge>}
                      {student.performanceStatus === 'active' && <Badge variant="info">نشط</Badge>}
                      <Badge variant="info">{student.fill_card_count || 0} فيل كارد</Badge>
                    </div>

                    {/* Attendance Info */}
                    <div>
                      <div className={styles.mobileSectionTitle}>الحضور والمحاضرات</div>
                      <div className={styles.progressContainer}>
                        <div className={styles.progressLabel}>
                          <span>نسبة الحضور:</span>
                          <strong>{student.attendanceRate}% ({student.presentCount + student.lateCount}/{data.sessions.length})</strong>
                        </div>
                        <div className={styles.progressBarBg}>
                          <div
                            className={styles.progressBarFill}
                            style={{
                              width: `${student.attendanceRate}%`,
                              backgroundColor: student.attendanceRate >= 80 ? 'var(--accent)' : student.attendanceRate >= 60 ? 'var(--amber)' : 'var(--danger)'
                            }}
                          />
                        </div>
                      </div>
                      <div className={styles.statusIndicatorGrid} style={{ marginTop: '10px' }}>
                        {data.sessions.map(session => {
                          const status = student.attendance[session.id] !== undefined ? student.attendance[session.id] : 3;
                          let statusClass = styles.noRecord;
                          let symbol = '—';
                          let statusName = 'غير مسجل';

                          if (status === 1) {
                            statusClass = styles.present;
                            symbol = '✓';
                            statusName = 'حضور';
                          } else if (status === 2) {
                            statusClass = styles.late;
                            symbol = '!';
                            statusName = 'تأخير';
                          } else if (status === 0) {
                            statusClass = styles.absent;
                            symbol = '✖';
                            statusName = 'غياب';
                          }

                          const tooltipId = `mob-att-${student.id}-${session.id}`;
                          const tooltipText = `${session.title} - ${statusName}`;

                          return (
                            <div
                              key={session.id}
                              className={styles.tooltipWrapper}
                              onClick={(e) => toggleTooltip(e, tooltipId, tooltipText)}
                            >
                              <span className={`${styles.statusCircle} ${statusClass}`}>
                                {symbol}
                              </span>
                              {activeTooltip && activeTooltip.id === tooltipId && (
                                <div className={styles.tooltipCard}>{activeTooltip.text}</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Tasks Info */}
                    <div>
                      <div className={styles.mobileSectionTitle}>تسليم التاسكات والتقييم</div>
                      <div className={styles.progressContainer}>
                        <div className={styles.progressLabel}>
                          <span>نسبة التسليم:</span>
                          <strong>{student.submissionRate}% ({student.submittedCount}/{data.tasks.length})</strong>
                        </div>
                        <div className={styles.progressBarBg}>
                          <div
                            className={styles.progressBarFill}
                            style={{
                              width: `${student.submissionRate}%`,
                              backgroundColor: student.submissionRate >= 80 ? 'var(--accent)' : student.submissionRate >= 50 ? 'var(--amber)' : 'var(--danger)'
                            }}
                          />
                        </div>
                      </div>
                      <div className={styles.statusIndicatorGrid} style={{ marginTop: '10px' }}>
                        {data.tasks.map(task => {
                          const taskObj = student.tasks[task.id] || { status: 3, grade: null };
                          let statusClass = styles.notSubmitted;
                          let symbol = '✖';
                          let tooltipText = `${task.title} - لم يتم التسليم`;

                          if (taskObj.status === 1) {
                            statusClass = styles.submittedGraded;
                            symbol = taskObj.grade;
                            tooltipText = `${task.title} - مقيّم: ${taskObj.grade}/10`;
                          } else if (taskObj.status === 2) {
                            statusClass = styles.submittedPending;
                            symbol = '!';
                            tooltipText = `${task.title} - قيد التقييم`;
                          }

                          const tooltipId = `mob-task-${student.id}-${task.id}`;

                          return (
                            <div
                              key={task.id}
                              className={styles.tooltipWrapper}
                              onClick={(e) => toggleTooltip(e, tooltipId, tooltipText)}
                            >
                              <span className={`${styles.statusCircle} ${statusClass}`}>
                                {symbol}
                              </span>
                              {activeTooltip && activeTooltip.id === tooltipId && (
                                <div className={styles.tooltipCard}>{activeTooltip.text}</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {student.averageGrade !== null && (
                        <div style={{ marginTop: '12px', fontSize: 'var(--font-sm)' }}>
                          متوسط تقييم الواجبات: <Badge variant="success">{student.averageGrade} / 10</Badge>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Controls */}
      {filteredStudents.length > 0 && (
        <div className={styles.paginationRow}>
          {/* Page size dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--font-xs)' }}>
            <span>عرض:</span>
            <select
              className={styles.paginationSelect}
              value={pageSize}
              onChange={e => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              aria-label="عدد الصفوف لكل صفحة"
            >
              <option value={10}>10 طلاب</option>
              <option value={25}>25 طالب</option>
              <option value={50}>50 طالب</option>
              <option value={100}>100 طالب</option>
            </select>
            <span style={{ color: 'var(--text-tertiary)' }}>
              (إجمالي {filteredStudents.length} متطابق)
            </span>
          </div>

          {/* Page buttons */}
          <div className={styles.pageControls}>
            <button
              className={styles.pageBtn}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              aria-label="الصفحة السابقة"
            >
              <IconChevronRight size={16} />
            </button>

            {Array.from({ length: totalPages }).map((_, idx) => {
              const pageNum = idx + 1;
              // Render current page, first, last, and pages adjacent to current page
              if (
                pageNum === 1 ||
                pageNum === totalPages ||
                Math.abs(pageNum - currentPage) <= 1
              ) {
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`${styles.pageBtn} ${currentPage === pageNum ? styles.activePage : ''}`}
                  >
                    {pageNum}
                  </button>
                );
              }
              // Show ellipses
              if (
                pageNum === 2 ||
                pageNum === totalPages - 1
              ) {
                return (
                  <span key={pageNum} style={{ color: 'var(--text-tertiary)', padding: '0 4px' }}>
                    ...
                  </span>
                );
              }
              return null;
            })}

            <button
              className={styles.pageBtn}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              aria-label="الصفحة التالية"
            >
              <IconChevronLeft size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
