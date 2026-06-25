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

const TABLE_LABELS = {
  users: 'المستخدمين',
  students: 'الطلاب',
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

  // ------- EXPORT / CREATE BACKUP -------
  const handleExport = async () => {
    setExporting(true);
    setExportSuccess(false);
    try {
      const res = await fetch(`${API_URL}/admin/backups`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'حدث خطأ أثناء إنشاء النسخة الاحتياطية');
      }

      setExportSuccess(true);
      toast.success(data.message || 'تم إنشاء النسخة الاحتياطية بنجاح');
      fetchBackups(); // Refresh backup list to show the new one
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err) {
      toast.error(err.message || 'حدث خطأ أثناء إنشاء النسخة الاحتياطية');
    }
    finally { setExporting(false); }
  };

  // ------- FILE UPLOAD -------
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isDb = file.name.endsWith('.db') || file.name.endsWith('.sqlite');

    // Validate extension
    if (!isDb) {
      toast.error('يرجى اختيار ملف بصيغة DB أو SQLite');
      return;
    }

    // Handle .db file upload (direct database restore)
    if (file.size > 500 * 1024 * 1024) {
      toast.error('حجم الملف يتجاوز الحد الأقصى (500 ميغابايت)');
      return;
    }
    setImportFile({ file, isDb: true });
    setImportSuccess(false);
    setDryRunResult(null);
    setValidating(true);

    try {
      const formData = new FormData();
      formData.append('dbfile', file);

      const res = await fetch(`${API_URL}/admin/validate-db`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل التحقق من ملف قاعدة البيانات');
      }

      setDryRunResult(data);
    } catch (err) {
      toast.error(err.message || 'حدث خطأ أثناء فحص ملف قاعدة البيانات');
      setImportFile(null);
    } finally {
      setValidating(false);
    }
  };

  // ------- IMPORT -------
  const handleImport = async () => {
    setConfirmImport(false);
    if (!importFile) return;

    setImporting(true);
    try {
      // Upload .db file via FormData
      const formData = new FormData();
      formData.append('dbfile', importFile.file);
      const res = await fetch(`${API_URL}/admin/import-db`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}` },
        body: formData,
      });

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
    setValidating(false);
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
            <h3 className={styles.sectionTitle}>إنشاء نسخة احتياطية جديدة</h3>
            <p className={styles.sectionDesc}>قم بإنشاء نسخة احتياطية كاملة لقاعدة بيانات المنصة بصيغة DB لحفظها أو تحميلها لاحقاً.</p>
          </div>
        </div>

        <div className={styles.exportActions}>
          <Button
            variant="primary"
            size="md"
            icon={exportSuccess ? IconCheck : IconDatabase}
            loading={exporting}
            onClick={handleExport}
            className={exportSuccess ? styles.successBtn : ''}
          >
            {exportSuccess ? 'تم إنشاء النسخة ✓' : 'إنشاء نسخة احتياطية الآن'}
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
        {!importFile && !validating && !importSuccess && (
          <div
            className={styles.uploadArea}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          >
            <IconUploadCloud size={32} className={styles.uploadIcon} />
            <span className={styles.uploadLabel}>اضغط لاختيار ملف النسخة الاحتياطية</span>
            <span className={styles.uploadHint}>ملفات DB أو SQLite فقط • الحد الأقصى 500MB</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".db,.sqlite"
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
            <span>جاري التحقق من ملف النسخة الاحتياطية وقراءة الإحصائيات...</span>
          </div>
        )}

        {/* Dry-run result */}
        {dryRunResult && importFile && !validating && !importSuccess && (
          <div className={styles.dryRunResult}>
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

            {/* Counts comparison table */}
            {dryRunResult.valid && (
              <div className={styles.countsTable}>
                <div className={styles.countsHeader}>
                  <span>الجدول</span>
                  <span>الحالي في المنصة</span>
                  <span>في النسخة الاحتياطية</span>
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
