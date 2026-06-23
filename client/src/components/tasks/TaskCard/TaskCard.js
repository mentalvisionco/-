'use client';
import { useState, useRef } from 'react';
import styles from './TaskCard.module.css';
import Badge from '@/components/ui/Badge/Badge';
import Button from '@/components/ui/Button/Button';
import Input from '@/components/ui/Input/Input';
import ProgressBar from '@/components/ui/ProgressBar/ProgressBar';
import { IconExternalLink, IconCheck, IconUpload, IconTrash, IconUploadCloud, IconFileText, IconLink, IconDownload, IconClose } from '@/components/icons';
import { getToken, API_URL } from '@/lib/api';

const MAX_FILE_SIZE = 600 * 1024 * 1024; // 600MB — matches server limit
const ACCEPTED_TYPES = '.pdf,.doc,.docx,.png,.jpg,.jpeg,.zip,.rar,.psd,.psb,.ai,.eps';

const getGradeDetails = (grade) => {
  if (grade === null || grade === undefined) return null;
  const g = Number(grade);
  if (g >= 40 && g <= 50) {
    return {
      text: 'تحفة فنية 😎👍',
      gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.03) 100%)',
      borderColor: 'rgba(16, 185, 129, 0.3)',
      color: '#10b981',
    };
  }
  if (g >= 30 && g < 40) {
    return {
      text: 'الفنان الصغير',
      gradient: 'linear-gradient(135deg, rgba(132, 204, 22, 0.12) 0%, rgba(101, 163, 13, 0.03) 100%)',
      borderColor: 'rgba(132, 204, 22, 0.3)',
      color: '#84cc16',
    };
  }
  if (g >= 20 && g < 30) {
    return {
      text: 'حلو يجي منك 🤝',
      gradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(217, 119, 6, 0.03) 100%)',
      borderColor: 'rgba(245, 158, 11, 0.3)',
      color: '#f59e0b',
    };
  }
  if (g >= 10 && g < 20) {
    return {
      text: 'شغال مش وحش 👏',
      gradient: 'linear-gradient(135deg, rgba(248, 113, 113, 0.12) 0%, rgba(220, 38, 38, 0.03) 100%)',
      borderColor: 'rgba(248, 113, 113, 0.3)',
      color: '#f87171',
    };
  }
  return {
    text: 'ارجح انك تشوف المحاضرة تاني 🙃',
    gradient: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(185, 28, 28, 0.03) 100%)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    color: '#ef4444',
  };
};

export default function TaskCard({ task, submission, onSubmit, onCancel }) {
  const isCompleted = !!submission;
  const [url, setUrl] = useState(submission?.fileUrl || '');
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('idle'); // 'idle' | 'uploading' | 'saving'
  const [uploadProgress, setUploadProgress] = useState(0);
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return;
    if (selectedFile.size > MAX_FILE_SIZE) {
      setError(`حجم الملف (${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB) يتجاوز الحد الأقصى المسموح به (600 MB).`);
      setFile(null);
      return;
    }
    setFile(selectedFile);
    setError('');
  };

  const handleRemoveFile = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragging false if we're leaving the dropzone itself
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFile = e.dataTransfer?.files?.[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Check validation: at least one submission method is required
    const hasUrl = !!url.trim();
    const hasNewFile = !!file;
    const hasExistingFile = !!submission?.uploadedFileUrl;

    if (!hasUrl && !hasNewFile && !hasExistingFile) {
      setError('يرجى تقديم رابط أو اختيار ملف للرفع لتسليم المهمة.');
      return;
    }

    setSubmitting(true);
    setUploadProgress(0);
    setSubmitStatus(hasNewFile ? 'uploading' : 'saving');

    try {
      await onSubmit(task.id, url, file, (progress) => {
        setUploadProgress(progress);
        if (progress === 100) {
          setSubmitStatus('saving');
        }
      });
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setError(err.message || 'حدث خطأ أثناء التسليم');
    } finally {
      setSubmitting(false);
      setSubmitStatus('idle');
      setUploadProgress(0);
    }
  };

  return (
    <div className={`${styles.card} ${isCompleted ? styles.completed : ''}`}>
      {/* ——— Header ——— */}
      <div className={styles.header}>
        <div className={styles.info}>
          <h4 className={styles.title}>{task.title}</h4>
          {task.description && <p className={styles.desc}>{task.description}</p>}
        </div>
        <Badge variant={isCompleted ? (submission.grade !== null ? 'success' : 'warning') : 'danger'} dot>
          {isCompleted ? (submission.grade !== null ? 'تم التقييم' : 'تم التسليم (في انتظار التقييم)') : 'لم يتم التسليم'}
        </Badge>
      </div>

      {/* ——— Task Details Button ——— */}
      <a href={task.taskUrl} target="_blank" rel="noopener noreferrer" className={styles.taskLink}>
        <IconExternalLink size={14} />
        <span>عرض تفاصيل المهمة</span>
      </a>

      {/* ——— Current Submission Details ——— */}
      {isCompleted && (
        <div className={styles.subDetailBox}>
          <strong className={styles.subDetailTitle}>التسليم الحالي:</strong>

          {/* Prominent Grade Display */}
          {submission.grade !== null && (() => {
            const gradeInfo = getGradeDetails(submission.grade);
            if (!gradeInfo) return null;
            return (
              <div
                className={styles.gradeDisplayCard}
                style={{
                  background: gradeInfo.gradient,
                  borderColor: gradeInfo.borderColor
                }}
              >
                <div className={styles.gradeInfoSection}>
                  <span className={styles.gradeTextLabel}>تقييم المهمة</span>
                  <div className={styles.gradeValueRow}>
                    <span className={styles.gradeValueNum} style={{ color: gradeInfo.color }}>
                      {submission.grade}
                    </span>
                    <span className={styles.gradeValueMax}>/ 50</span>
                    <span
                      className={styles.gradeStatusBadge}
                      style={{
                        backgroundColor: gradeInfo.gradient,
                        borderColor: gradeInfo.borderColor,
                        color: gradeInfo.color
                      }}
                    >
                      {gradeInfo.text}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Submitted URL card */}
          {submission.fileUrl && (
            <div className={styles.subItemCard}>
              <div className={`${styles.subItemIcon} ${styles.subItemIconLink}`}>
                <IconLink size={18} />
              </div>
              <div className={styles.subItemInfo}>
                <span className={styles.subItemLabel}>رابط الإنجاز</span>
                <span className={styles.subItemValue} title={submission.fileUrl}>
                  {submission.fileUrl}
                </span>
              </div>
              <a
                href={submission.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`${styles.subItemBtn} ${styles.subItemBtnLink}`}
              >
                <IconExternalLink size={12} />
                <span>فتح الرابط</span>
              </a>
            </div>
          )}

          {/* Divider between items */}
          {submission.fileUrl && submission.uploadedFileUrl && (
            <hr className={styles.subDivider} />
          )}

          {/* Uploaded file card */}
          {submission.uploadedFileUrl && (
            <div className={styles.subItemCard}>
              <div className={`${styles.subItemIcon} ${styles.subItemIconFile}`}>
                <IconFileText size={18} />
              </div>
              <div className={styles.subItemInfo}>
                <span className={styles.subItemLabel}>الملف المرفوع</span>
                <span className={styles.subItemValue} title={submission.uploadedFileName}>
                  {submission.uploadedFileName}
                </span>
              </div>
              <a
                href={submission.uploadedFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`${styles.subItemBtn} ${styles.subItemBtnFile}`}
              >
                <IconDownload size={12} />
                <span>تحميل الملف</span>
              </a>
            </div>
          )}

          {/* Teacher Feedback / Notes & Image Section */}
          {(submission.feedback || submission.feedbackFileUrl) && (
            <div className={styles.feedbackBox}>
              {submission.feedback && (
                <div>
                  <strong className={styles.feedbackTitle}>ملاحظات المعلم:</strong>
                  <p className={styles.feedbackText}>{submission.feedback}</p>
                </div>
              )}
              {submission.feedbackFileUrl && (() => {
                const getDriveId = (url) => {
                  if (!url) return null;
                  const match = url.match(/drive\.google\.com\/file\/d\/([^\/]+)/);
                  return match ? match[1] : null;
                };
                const fileId = submission.feedbackFileId || getDriveId(submission.feedbackFileUrl);
                const token = getToken();
                const displayUrl = fileId
                  ? `${API_URL}/files/${fileId}?token=${token}`
                  : submission.feedbackFileUrl;

                return (
                  <div className={submission.feedback ? styles.feedbackFileSection : ''}>
                    <span className={styles.feedbackFileLabel}>الصورة التوضيحية المرفقة من المعلم:</span>
                    <a href={displayUrl} target="_blank" rel="noopener noreferrer" className={styles.feedbackImgLink}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={displayUrl}
                        alt="توضيح المعلم"
                        className={styles.feedbackImg}
                      />
                    </a>
                  </div>
                );
              })()}

            </div>
          )}
        </div>
      )}

      {/* ——— Submission Form ——— */}
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formFieldsGrid}>

          {/* External Link URL Input */}
          <div className={styles.formFieldWrapper}>
            <Input
              label="رابط الإنجاز (امتحان Google Forms)"
              type="url"
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              size="md"
            />
          </div>

          {/* File Upload Dropzone */}
          <div className={styles.formFieldWrapper}>
            <label className={styles.fieldLabel}>
              تحميل ملف (PDF, DOCX, ZIP, RAR, صور, PSD, AI)
            </label>

            <div
              className={`${styles.dropzone} ${isDragging ? styles.dropzoneDragging : ''}`}
              onDragOver={handleDragOver}
              onDragEnter={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              role="button"
              tabIndex={0}
              aria-label="منطقة رفع الملفات — اسحب ملفاً هنا أو اضغط للاختيار"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
            >
              <input
                type="file"
                id={`file-upload-${task.id}`}
                ref={fileInputRef}
                onChange={(e) => {
                  handleFileSelect(e.target.files[0] || null);
                }}
                style={{ display: 'none' }}
                accept={ACCEPTED_TYPES}
              />

              {!file ? (
                <label
                  htmlFor={`file-upload-${task.id}`}
                  className={styles.dropzoneLabel}
                >
                  <IconUploadCloud size={36} className={styles.dropzoneIcon} />
                  <span className={styles.dropzoneTitle}>اسحب ملفاً هنا أو اضغط للاختيار</span>
                  <span className={styles.dropzoneHint}>
                    PDF, DOCX, ZIP, RAR, PNG, JPG, PSD, AI — الحد الأقصى: 600 ميغابايت
                  </span>
                </label>
              ) : (
                <div className={styles.selectedFile}>
                  <div className={styles.selectedFileIcon}>
                    <IconFileText size={18} />
                  </div>
                  <div className={styles.selectedFileInfo}>
                    <span className={styles.selectedFileName} title={file.name}>
                      {file.name}
                    </span>
                    <span className={styles.selectedFileSize}>
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  </div>
                  <button
                    type="button"
                    className={styles.removeFileBtn}
                    onClick={handleRemoveFile}
                    aria-label="إزالة الملف المختار"
                  >
                    <IconClose size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className={styles.errorMsg}>
            ⚠️ {error}
          </div>
        )}

        {submitting && file && (
          <div className={styles.progressWrapper}>
            <ProgressBar
              value={uploadProgress}
              max={100}
              label={submitStatus === 'uploading' ? 'جاري رفع الملف...' : 'جاري معالجة وحفظ البيانات...'}
              showPercent={true}
              className={styles.uploadProgress}
            />
          </div>
        )}

        <div className={styles.buttonGroup}>
          <Button
            type="submit"
            variant={isCompleted ? 'secondary' : 'primary'}
            size="md"
            loading={submitting}
            icon={isCompleted ? IconCheck : IconUpload}
          >
            {submitting ? (
              submitStatus === 'uploading' ? `جاري الرفع... (${uploadProgress}%)` : 'جاري الحفظ والتحقق...'
            ) : (
              isCompleted ? 'تحديث التسليم' : 'تسليم المهمة'
            )}
          </Button>

          {isCompleted && onCancel && (
            <Button
              type="button"
              variant="danger"
              size="md"
              onClick={() => onCancel(task.id)}
              disabled={submitting}
              icon={IconTrash}
            >
              إلغاء التسليم
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
