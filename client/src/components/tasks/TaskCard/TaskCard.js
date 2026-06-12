'use client';
import { useState } from 'react';
import styles from './TaskCard.module.css';
import Badge from '@/components/ui/Badge/Badge';
import Button from '@/components/ui/Button/Button';
import Input from '@/components/ui/Input/Input';
import ProgressBar from '@/components/ui/ProgressBar/ProgressBar';
import { IconExternalLink, IconCheck, IconUpload, IconTrash } from '@/components/icons';

export default function TaskCard({ task, submission, onSubmit, onCancel }) {
  const isCompleted = !!submission;
  const [url, setUrl] = useState(submission?.fileUrl || '');
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('idle'); // 'idle' | 'uploading' | 'saving'
  const [uploadProgress, setUploadProgress] = useState(0);
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');

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
      <div className={styles.header}>
        <div className={styles.info}>
          <h4 className={styles.title}>{task.title}</h4>
          {task.description && <p className={styles.desc}>{task.description}</p>}
        </div>
        <Badge variant={isCompleted ? (submission.grade !== null ? 'success' : 'warning') : 'danger'} dot>
          {isCompleted ? (submission.grade !== null ? `تم التقييم: ${submission.grade} / 50` : 'تم التسليم (في انتظار التقييم)') : 'لم يتم التسليم'}
        </Badge>
      </div>

      <a href={task.taskUrl} target="_blank" rel="noopener noreferrer" className={styles.taskLink}>
        <IconExternalLink size={14} />
        <span>عرض تفاصيل المهمة</span>
      </a>

      {isCompleted && (
        <div style={{
          background: 'var(--surface-2)',
          padding: '16px',
          borderRadius: 'var(--radius-lg)',
          border: '1px dashed var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          fontSize: '14px',
          marginTop: '4px'
        }}>
          <strong style={{ color: 'var(--text-primary)', fontSize: '15px' }}>التسليم الحالي:</strong>

          {submission.fileUrl && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: 'var(--text-tertiary)', minWidth: '80px' }}>الرابط:</span>
              <a href={submission.fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-text)', wordBreak: 'break-all', textDecoration: 'underline', fontWeight: '500' }}>
                {submission.fileUrl}
              </a>
            </div>
          )}

          {submission.uploadedFileUrl && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--text-tertiary)', minWidth: '80px' }}>الملف المرفوع:</span>
                <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{submission.uploadedFileName}</span>
              </div>
              <a
                href={submission.uploadedFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.taskLink}
                style={{
                  background: 'var(--accent-muted)',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '13px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  margin: 0,
                  border: '1px solid var(--accent-subtle)'
                }}
              >
                <IconExternalLink size={13} />
                <span>فتح / تحميل الملف</span>
              </a>
            </div>
          )}

          {/* Teacher Feedback / Notes & Image Section */}
          {(submission.feedback || submission.feedbackFileUrl) && (
            <div style={{
              marginTop: '12px',
              padding: '16px',
              background: 'var(--accent-muted)',
              borderRadius: 'var(--radius-md)',
              borderRight: '4px solid var(--accent)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              {submission.feedback && (
                <div>
                  <strong style={{ display: 'block', color: 'var(--accent-text)', marginBottom: '4px', fontSize: '14px' }}>ملاحظات المعلم:</strong>
                  <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: '13.5px', lineHeight: '1.6' }}>{submission.feedback}</p>
                </div>
              )}
              {submission.feedbackFileUrl && (
                <div style={{ marginTop: submission.feedback ? '4px' : '0' }}>
                  <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '8px', fontWeight: '500' }}>الصورة التوضيحية المرفقة من المعلم:</span>
                  <a href={submission.feedbackFileUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', maxWidth: '100%' }}>
                    <img 
                      src={submission.feedbackFileUrl} 
                      alt="توضيح المعلم" 
                      style={{
                        maxWidth: '100%',
                        maxHeight: '320px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-subtle)',
                        boxShadow: 'var(--shadow-sm)',
                        cursor: 'zoom-in',
                        objectFit: 'contain',
                        background: 'var(--surface-3)'
                      }} 
                    />
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.form} style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'stretch' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', width: '100%', alignItems: 'start' }}>

          {/* External Link URL Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Input
              label="رابط الإنجاز (امتحان Google Forms)"
              type="url"
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              size="md"
            />
          </div>

          {/* File Upload Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>
              تحميل ملف (PDF, DOCX, ZIP, صور, PSD, AI)
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
              <input
                type="file"
                id={`file-upload-${task.id}`}
                onChange={(e) => {
                  setFile(e.target.files[0] || null);
                  setError('');
                }}
                style={{ display: 'none' }}
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.zip,.psd,.psb,.ai,.eps"
              />

              <label
                htmlFor={`file-upload-${task.id}`}
                className={styles.taskLink}
                style={{
                  cursor: 'pointer',
                  border: '1px solid var(--border-default)',
                  background: 'var(--surface-1)',
                  padding: '10px 18px',
                  borderRadius: 'var(--radius-md)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  margin: 0,
                  fontSize: '14px',
                  fontWeight: '500',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'all var(--duration-fast)'
                }}
              >
                <IconUpload size={15} />
                <span>اختر ملفًا...</span>
              </label>

              {file && (
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: 'var(--text-primary)',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    maxWidth: '180px'
                  }}>
                    {file.name}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                    ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div style={{
            color: 'var(--red)',
            fontSize: '13px',
            background: 'var(--red-muted)',
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--red-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            ⚠️ {error}
          </div>
        )}

        {submitting && file && (
          <div style={{ width: '100%', marginTop: '4px', marginBottom: '8px' }}>
            <ProgressBar
              value={uploadProgress}
              max={100}
              label={submitStatus === 'uploading' ? 'جاري رفع الملف...' : 'جاري معالجة وحفظ البيانات...'}
              showPercent={true}
              className={styles.uploadProgress}
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
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
