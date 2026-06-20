'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from '@/contexts/ToastContext';
import { API_URL, getToken } from '@/lib/api';
import Card from '@/components/ui/Card/Card';
import Button from '@/components/ui/Button/Button';
import Badge from '@/components/ui/Badge/Badge';
import ConfirmDialog from '@/components/ui/ConfirmDialog/ConfirmDialog';
import {
  IconDownload, IconUploadCloud, IconShield, IconDatabase,
  IconRefresh, IconTrash, IconCheck, IconAlertCircle, IconSettings,
} from '@/components/icons';
import styles from './BackupPanel.module.css';

const SCOPE_OPTIONS = [
  { value: 'full', label: 'نسخة كاملة', desc: 'جميع البيانات' },
  { value: 'users', label: 'المستخدمين فقط', desc: 'الحسابات والنقاط' },
  { value: 'content', label: 'المحتوى فقط', desc: 'المحاضرات والمهام' },
  { value: 'submissions', label: 'التسليمات فقط', desc: 'التسليمات والتقييمات' },
  { value: 'attendance', label: 'الحضور فقط', desc: 'جلسات وسجلات الحضور' },
];

const TABLE_LABELS = {
  users: 'المستخدمين',
  lectures: 'المحاضرات',
  tasks: 'المهام',
  submissions: 'التسليمات',
  ratings: 'التقييمات',
  attendance_sessions: 'جلسات الحضور',
  attendance_records: 'سجلات الحضور',
};

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(dateStr) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ar-EG', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return dateStr; }
}

export default function BackupPanel() {
  const { toast } = useToast();
  const fileInputRef = useRef(null);

  // Export state
  const [exportScope, setExportScope] = useState('full');
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Import state
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [dryRunResult, setDryRunResult] = useState(null);
  const [importSuccess, setImportSuccess] = useState(false);

  // Backup history
  const [backups, setBackups] = useState([]);
  const [loadingBackups, setLoadingBackups] = useState(false);

  // Confirm dialogs
  const [confirmImport, setConfirmImport] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState({ open: false, filename: '' });

  // ------- Helpers -------
  const authHeaders = useCallback(() => ({
    'Authorization': `Bearer ${getToken()}`,
    'Content-Type': 'application/json',
  }), []);

  // ------- Fetch backup history -------
  const fetchBackups = useCallback(async () => {
    setLoadingBackups(true);
    try {
      const res = await fetch(`${API_URL}/admin/backups`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setBackups(data);
      }
    } catch { /* silent */ }
    finally { setLoadingBackups(false); }
  }, [authHeaders]);

  useEffect(() => { fetchBackups(); }, [fetchBackups]);

  // Helper to fetch files that require authentication (handles token refresh)
  const fetchFileWithAuth = useCallback(async (url) => {
    let token = getToken();
    const headers = {
      'Authorization': `Bearer ${token}`,
      'X-Requested-With': 'XMLHttpRequest'
    };

    let res = await fetch(url, { headers });

    if (res.status === 401 && token) {
      try {
        const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          credentials: 'include'
        });

        if (refreshRes.ok) {
          const data = await refreshRes.json();
          const newToken = data.accessToken;
          if (typeof window !== 'undefined') {
            localStorage.setItem('lms_token', newToken);
          }
          headers['Authorization'] = `Bearer ${newToken}`;
          res = await fetch(url, { headers });
        } else {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('lms_token');
            localStorage.removeItem('currentUser');
            window.location.href = '/';
          }
        }
      } catch {
        // failed to refresh
      }
    }
    return res;
  }, [authHeaders]);

  // ------- EXPORT -------
  const handleExport = async () => {
    setExporting(true);
    setExportSuccess(false);
    try {
      const date = new Date().toISOString().slice(0, 10);
      const filename = `lms-backup-${exportScope}-${date}.json`;
      const url = `${API_URL}/admin/export?scope=${exportScope}`;
      
      const res = await fetchFileWithAuth(url);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'حدث خطأ أثناء تصدير البيانات');
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);

      setExportSuccess(true);
      toast.success('تم تصدير البيانات بنجاح');
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err) {
      toast.error(err.message || 'حدث خطأ أثناء التصدير');
    }
    finally { setExporting(false); }
  };

  // ------- FILE UPLOAD -------
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isDb = file.name.endsWith('.db') || file.name.endsWith('.sqlite');
    const isJson = file.name.endsWith('.json');

    // Validate extension
    if (!isJson && !isDb) {
      toast.error('يرجى اختيار ملف بصيغة JSON أو DB');
      return;
    }

    // Handle .db file upload (direct database restore)
    if (isDb) {
      if (file.size > 500 * 1024 * 1024) {
        toast.error('حجم الملف يتجاوز الحد الأقصى (500 ميغابايت)');
        return;
      }
      setImportFile({ file, isDb: true });
      setDryRunResult({ valid: true, isDbFile: true });
      setImportSuccess(false);
      return;
    }

    // Validate size (50MB max for JSON)
    if (file.size > 50 * 1024 * 1024) {
      toast.error('حجم الملف يتجاوز الحد الأقصى (50 ميغابايت)');
      return;
    }

    // Validate MIME type
    if (file.type && !['application/json', 'text/plain', ''].includes(file.type)) {
      toast.error('نوع الملف غير مدعوم');
      return;
    }

    // Parse and validate client-side first
    try {
      const text = await file.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        toast.error('الملف لا يحتوي على بيانات JSON صالحة');
        return;
      }

      if (!parsed.meta || parsed.meta.platform !== 'lms-platform') {
        toast.error('هذا الملف ليس نسخة احتياطية لمنصة LMS');
        return;
      }

      setImportFile({ file, parsed });
      setDryRunResult(null);
      setImportSuccess(false);

      // Run server-side dry-run validation
      setValidating(true);
      const res = await fetch(`${API_URL}/admin/validate-backup`, {
        method: 'POST',
        headers: authHeaders(),
        body: text,
      });
      const result = await res.json();
      setDryRunResult(result);
      setValidating(false);

      if (!result.valid) {
        toast.warning('الملف يحتوي على مشاكل — راجع التفاصيل');
      }
    } catch (err) {
      toast.error('فشل في قراءة الملف');
      setValidating(false);
    }
  };

  // ------- IMPORT -------
  const handleImport = async () => {
    setConfirmImport(false);
    if (!importFile) return;

    setImporting(true);
    try {
      let res;

      if (importFile.isDb) {
        // Upload .db file via FormData
        const formData = new FormData();
        formData.append('dbfile', importFile.file);
        res = await fetch(`${API_URL}/admin/import-db`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${getToken()}` },
          body: formData,
        });
      } else {
        // Send JSON import
        res = await fetch(`${API_URL}/admin/import`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(importFile.parsed),
        });
      }

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'حدث خطأ أثناء الاستيراد');
        return;
      }

      setImportSuccess(true);
      setImportFile(null);
      setDryRunResult(null);
      toast.success(data.message || 'تم استيراد البيانات بنجاح');
      fetchBackups();

      setTimeout(() => setImportSuccess(false), 5000);
    } catch (err) {
      toast.error('حدث خطأ أثناء الاستيراد');
    }
    finally { setImporting(false); }
  };

  // ------- DOWNLOAD BACKUP -------
  const handleDownloadBackup = async (filename) => {
    try {
      const url = `${API_URL}/admin/backups/${encodeURIComponent(filename)}`;
      const res = await fetchFileWithAuth(url);
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'فشل تحميل النسخة الاحتياطية');
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
      toast.success('تم تحميل النسخة الاحتياطية');
    } catch (err) {
      toast.error(err.message || 'فشل تحميل النسخة الاحتياطية');
    }
  };

  // ------- DELETE BACKUP -------
  const handleDeleteBackup = async () => {
    const filename = confirmDelete.filename;
    setConfirmDelete({ open: false, filename: '' });
    try {
      const res = await fetch(`${API_URL}/admin/backups/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error();
      toast.success('تم حذف النسخة الاحتياطية');
      fetchBackups();
    } catch {
      toast.error('فشل حذف النسخة الاحتياطية');
    }
  };

  const clearImport = () => {
    setImportFile(null);
    setDryRunResult(null);
    setImportSuccess(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className={styles.panel}>

      {/* ═══════ EXPORT SECTION ═══════ */}
      <Card className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionIcon + ' ' + styles.exportIcon}>
            <IconDatabase size={22} />
          </div>
          <div className={styles.sectionTitleWrap}>
            <h3 className={styles.sectionTitle}>تصدير البيانات</h3>
            <p className={styles.sectionDesc}>قم بتصدير بيانات المنصة كملف JSON للحفظ أو النقل</p>
          </div>
        </div>

        <div className={styles.scopeGrid}>
          {SCOPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`${styles.scopeBtn} ${exportScope === opt.value ? styles.scopeActive : ''}`}
              onClick={() => setExportScope(opt.value)}
            >
              <span className={styles.scopeLabel}>{opt.label}</span>
              <span className={styles.scopeDesc}>{opt.desc}</span>
            </button>
          ))}
        </div>

        <div className={styles.exportActions}>
          <Button
            variant="primary"
            size="md"
            icon={exportSuccess ? IconCheck : IconDownload}
            loading={exporting}
            onClick={handleExport}
            className={exportSuccess ? styles.successBtn : ''}
          >
            {exportSuccess ? 'تم التصدير ✓' : 'تصدير الآن'}
          </Button>
        </div>
      </Card>

      {/* ═══════ IMPORT SECTION ═══════ */}
      <Card className={`${styles.section} ${styles.dangerSection}`}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionIcon + ' ' + styles.importIcon}>
            <IconUploadCloud size={22} />
          </div>
          <div className={styles.sectionTitleWrap}>
            <h3 className={styles.sectionTitle}>استعادة البيانات</h3>
            <p className={styles.sectionDesc}>استعادة بيانات المنصة من نسخة احتياطية سابقة</p>
          </div>
          <Badge variant="warning">منطقة حساسة</Badge>
        </div>

        <div className={styles.warningBanner}>
          <IconAlertCircle size={16} />
          <span>تحذير: استيراد نسخة احتياطية سيستبدل جميع البيانات الحالية. يتم إنشاء نسخة احتياطية تلقائية قبل الاستيراد.</span>
        </div>

        {/* Upload Area */}
        {!importFile && !importSuccess && (
          <div
            className={styles.uploadArea}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          >
            <IconUploadCloud size={32} className={styles.uploadIcon} />
            <span className={styles.uploadLabel}>اضغط لاختيار ملف النسخة الاحتياطية</span>
            <span className={styles.uploadHint}>JSON أو DB • الحد الأقصى 50MB للـ JSON / 500MB للـ DB</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.db,.sqlite,application/json"
              onChange={handleFileSelect}
              className={styles.fileInput}
              aria-label="اختيار ملف نسخة احتياطية"
            />
          </div>
        )}

        {/* Validating spinner */}
        {validating && (
          <div className={styles.validatingState}>
            <div className={styles.spinner} />
            <span>جاري التحقق من صحة الملف...</span>
          </div>
        )}

        {/* Dry-run result */}
        {dryRunResult && importFile && !importSuccess && (
          <div className={styles.dryRunResult}>
            {/* DB file info (no dry-run, just confirmation) */}
            {dryRunResult.isDbFile ? (
              <>
                <div className={styles.dryRunMeta}>
                  <div className={styles.dryRunMetaItem}>
                    <span className={styles.metaLabel}>نوع الملف</span>
                    <span className={styles.metaValue}>ملف قاعدة بيانات SQLite (.db)</span>
                  </div>
                  <div className={styles.dryRunMetaItem}>
                    <span className={styles.metaLabel}>اسم الملف</span>
                    <span className={styles.metaValue}>{importFile.file.name}</span>
                  </div>
                  <div className={styles.dryRunMetaItem}>
                    <span className={styles.metaLabel}>حجم الملف</span>
                    <span className={styles.metaValue}>{formatFileSize(importFile.file.size)}</span>
                  </div>
                </div>
                <div className={styles.warningBanner}>
                  <IconAlertCircle size={16} />
                  <span>سيتم استبدال قاعدة البيانات بالكامل بهذا الملف. يتم حفظ نسخة احتياطية تلقائياً قبل الاستبدال.</span>
                </div>
                <div className={styles.importActions}>
                  <Button variant="secondary" size="md" onClick={clearImport}>إلغاء</Button>
                  <Button
                    variant="danger"
                    size="md"
                    icon={IconRefresh}
                    loading={importing}
                    onClick={() => setConfirmImport(true)}
                  >
                    استعادة من ملف DB
                  </Button>
                </div>
              </>
            ) : (
              <>
                {/* Meta info */}
                <div className={styles.dryRunMeta}>
                  <div className={styles.dryRunMetaItem}>
                    <span className={styles.metaLabel}>تاريخ التصدير</span>
                    <span className={styles.metaValue}>{formatDate(dryRunResult.meta?.exportedAt)}</span>
                  </div>
                  <div className={styles.dryRunMetaItem}>
                    <span className={styles.metaLabel}>الإصدار</span>
                    <span className={styles.metaValue}>{dryRunResult.meta?.version || '—'}</span>
                  </div>
                  <div className={styles.dryRunMetaItem}>
                    <span className={styles.metaLabel}>حجم الملف</span>
                    <span className={styles.metaValue}>{formatFileSize(importFile.file.size)}</span>
                  </div>
                  <div className={styles.dryRunMetaItem}>
                    <span className={styles.metaLabel}>النطاق</span>
                    <span className={styles.metaValue}>{dryRunResult.meta?.scope === 'full' ? 'نسخة كاملة' : dryRunResult.meta?.scope}</span>
                  </div>
                </div>

                {/* Counts comparison table */}
                {dryRunResult.valid && (
                  <div className={styles.countsTable}>
                    <div className={styles.countsHeader}>
                      <span>الجدول</span>
                      <span>الحالي</span>
                      <span>في النسخة</span>
                    </div>
                    {Object.keys(TABLE_LABELS).map(table => (
                      <div key={table} className={styles.countsRow}>
                        <span className={styles.countLabel}>{TABLE_LABELS[table]}</span>
                        <span className={styles.countCurrent}>{dryRunResult.currentCounts?.[table] ?? '—'}</span>
                        <span className={styles.countImport}>{dryRunResult.importCounts?.[table] ?? '—'}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Errors */}
                {dryRunResult.errors?.length > 0 && (
                  <div className={styles.errorList}>
                    <h5 className={styles.issueTitle}>
                      <IconAlertCircle size={14} /> أخطاء ({dryRunResult.errors.length})
                    </h5>
                    {dryRunResult.errors.map((err, i) => (
                      <div key={i} className={styles.errorItem}>{err}</div>
                    ))}
                  </div>
                )}

                {/* Warnings */}
                {dryRunResult.warnings?.length > 0 && (
                  <div className={styles.warningList}>
                    <h5 className={styles.issueTitle}>
                      <IconAlertCircle size={14} /> تحذيرات ({dryRunResult.warnings.length})
                    </h5>
                    {dryRunResult.warnings.map((w, i) => (
                      <div key={i} className={styles.warningItem}>{w}</div>
                    ))}
                  </div>
                )}

                {/* Conflicts */}
                {dryRunResult.conflicts?.length > 0 && (
                  <div className={styles.warningList}>
                    <h5 className={styles.issueTitle}>
                      <IconAlertCircle size={14} /> تعارضات ({dryRunResult.conflicts.length})
                    </h5>
                    {dryRunResult.conflicts.map((c, i) => (
                      <div key={i} className={styles.warningItem}>{c}</div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className={styles.importActions}>
                  <Button variant="secondary" size="md" onClick={clearImport}>إلغاء</Button>
                  {dryRunResult.valid && (
                    <Button
                      variant="danger"
                      size="md"
                      icon={IconRefresh}
                      loading={importing}
                      onClick={() => setConfirmImport(true)}
                    >
                      استعادة البيانات
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Import success */}
        {importSuccess && (
          <div className={styles.successState}>
            <div className={styles.successIconWrap}>
              <IconCheck size={28} />
            </div>
            <h4>تمت الاستعادة بنجاح</h4>
            <p>تم استيراد جميع البيانات بنجاح. تم حفظ نسخة احتياطية تلقائية من البيانات السابقة.</p>
            <Button variant="secondary" size="sm" onClick={clearImport}>رفع ملف آخر</Button>
          </div>
        )}
      </Card>

      {/* ═══════ BACKUP HISTORY ═══════ */}
      <Card className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionIcon + ' ' + styles.historyIcon}>
            <IconShield size={22} />
          </div>
          <div className={styles.sectionTitleWrap}>
            <h3 className={styles.sectionTitle}>سجل النسخ الاحتياطية</h3>
            <p className={styles.sectionDesc}>النسخ الاحتياطية التلقائية المحفوظة على الخادم</p>
          </div>
          <Button variant="ghost" size="sm" icon={IconRefresh} onClick={fetchBackups} loading={loadingBackups}>
            تحديث
          </Button>
        </div>

        {backups.length === 0 ? (
          <div className={styles.emptyBackups}>
            <IconShield size={28} className={styles.emptyIcon} />
            <span>لا توجد نسخ احتياطية محفوظة بعد</span>
            <small>سيتم إنشاء نسخة تلقائية عند كل عملية استيراد</small>
          </div>
        ) : (
          <div className={styles.backupList}>
            {backups.map((b, i) => (
              <div key={b.filename} className={styles.backupItem} style={{ animationDelay: `${i * 50}ms` }}>
                <div className={styles.backupInfo}>
                  <span className={styles.backupName}>{b.filename}</span>
                  <div className={styles.backupMeta}>
                    <span>{formatDate(b.createdAt)}</span>
                    <span className={styles.dot}>•</span>
                    <span>{formatFileSize(b.size)}</span>
                  </div>
                </div>
                <div className={styles.backupActions}>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={IconDownload}
                    onClick={() => handleDownloadBackup(b.filename)}
                  >
                    تحميل
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={IconTrash}
                    onClick={() => setConfirmDelete({ open: true, filename: b.filename })}
                    className={styles.deleteBtn}
                  >
                    حذف
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ═══════ SAFETY INFO ═══════ */}
      <div className={styles.safetyInfo}>
        <div className={styles.safetyItem}>
          <IconShield size={15} />
          <span>يتم إنشاء نسخة احتياطية (.db) تلقائياً قبل كل عملية استيراد</span>
        </div>
        <div className={styles.safetyItem}>
          <IconShield size={15} />
          <span>كلمات المرور والرموز تبقى سليمة بعد الاستيراد</span>
        </div>
        <div className={styles.safetyItem}>
          <IconShield size={15} />
          <span>النصوص العربية تُحفظ بتشفير UTF-8 بدون أي تغيير</span>
        </div>
        <div className={styles.safetyItem}>
          <IconShield size={15} />
          <span>استيراد JSON يتم داخل Transaction — في حال الفشل يتم التراجع تلقائياً ولا تتأثر البيانات</span>
        </div>
        <div className={styles.safetyItem}>
          <IconShield size={15} />
          <span>يتم تفعيل وضع الصيانة تلقائياً أثناء الاستيراد لمنع التعارضات</span>
        </div>
      </div>

      {/* ═══════ CONFIRM DIALOGS ═══════ */}
      <ConfirmDialog
        isOpen={confirmImport}
        onClose={() => setConfirmImport(false)}
        onConfirm={handleImport}
        title="تأكيد الاستعادة"
        message="سيتم استبدال جميع البيانات الحالية ببيانات النسخة الاحتياطية. هذا الإجراء لا يمكن التراجع عنه. سيتم حفظ نسخة احتياطية تلقائية من البيانات الحالية قبل الاستعادة."
        confirmLabel="استعادة"
        variant="danger"
        loading={importing}
      />

      <ConfirmDialog
        isOpen={confirmDelete.open}
        onClose={() => setConfirmDelete({ open: false, filename: '' })}
        onConfirm={handleDeleteBackup}
        title="حذف النسخة الاحتياطية"
        message={`هل أنت متأكد من حذف "${confirmDelete.filename}"؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmLabel="حذف"
        variant="danger"
      />
    </div>
  );
}
