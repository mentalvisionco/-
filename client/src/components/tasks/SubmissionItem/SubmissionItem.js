'use client';

import { useState } from 'react';
import Card from '@/components/ui/Card/Card';
import Badge from '@/components/ui/Badge/Badge';
import Input from '@/components/ui/Input/Input';
import Button from '@/components/ui/Button/Button';
import { IconExternalLink, IconTrash, IconUpload } from '@/components/icons';
import styles from './SubmissionItem.module.css';

export default function SubmissionItem({ sub, onGrade }) {
  const [grade, setGrade] = useState(sub.grade ?? '');
  const [feedback, setFeedback] = useState(sub.feedback ?? '');
  const [file, setFile] = useState(null);
  const [deleteFileFlag, setDeleteFileFlag] = useState(false);
  const [saving, setSaving] = useState(false);

  const hasExistingFile = !!sub.feedbackFileUrl && !deleteFileFlag;
  const isChanged = 
    grade !== (sub.grade ?? '') || 
    feedback !== (sub.feedback ?? '') || 
    file !== null || 
    deleteFileFlag;

  const handleSave = async () => {
    const parsedGrade = parseInt(grade);
    if (isNaN(parsedGrade) || parsedGrade < 0 || parsedGrade > 50) {
      alert('التقييم يجب أن يكون بين 0 و 50');
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('grade', parsedGrade);
      formData.append('feedback', feedback);
      if (file) {
        formData.append('file', file);
      }
      if (deleteFileFlag) {
        formData.append('deleteFeedbackFile', 'true');
      }

      await onGrade(sub.id, formData);
      setFile(null);
      setDeleteFileFlag(false);
    } catch (err) {
      // error is already handled
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card padding="sm" className={styles.submissionCard}>
      <div className={styles.info}>
        <div className={styles.header}>
          <strong className={styles.studentName}>{sub.studentName}</strong>
          <Badge variant={sub.grade !== null ? 'success' : 'warning'}>
            {sub.grade !== null ? `تم التقييم: ${sub.grade}/50` : 'بانتظار التقييم'}
          </Badge>
        </div>
        <p className={styles.taskTitle}>{sub.taskTitle}</p>
        
        <div className={styles.links}>
          {sub.fileUrl && sub.fileUrl.startsWith('http') && (
            <a href={sub.fileUrl} target="_blank" rel="noopener noreferrer" className={styles.link}>
              <IconExternalLink size={13} /> عرض الرابط الخارجي
            </a>
          )}
          {sub.uploadedFileUrl && (
            <a href={sub.uploadedFileUrl} target="_blank" rel="noopener noreferrer" className={`${styles.link} ${styles.uploadedFile}`}>
              <IconExternalLink size={13} /> عرض الملف المرفوع ({sub.uploadedFileName || 'ملف'})
            </a>
          )}
        </div>

        {/* Existing Feedback File Section */}
        {hasExistingFile && (
          <div className={styles.attachment}>
            <span className={styles.attachmentLabel}>المرفق الحالي:</span>
            <a href={sub.feedbackFileUrl} target="_blank" rel="noopener noreferrer" className={styles.attachmentLink}>
              {sub.feedbackFileName || 'صورة التوضيح'}
            </a>
            <button 
              type="button" 
              onClick={() => setDeleteFileFlag(true)} 
              title="حذف الملف المرفق" 
              className={styles.deleteBtn}
            >
              <IconTrash size={14} />
            </button>
          </div>
        )}
      </div>

      <div className={styles.actions}>
        <div className={styles.formFields}>
          <div className={styles.fieldWrap}>
            <label className={styles.fieldLabel}>الدرجة من 50</label>
            <Input
              type="number"
              placeholder="الدرجة"
              min="0"
              max="50"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className={styles.gradeInput}
            />
          </div>
          
          <div className={styles.fieldWrapFeedback}>
            <label className={styles.fieldLabel}>ملاحظات للطالب</label>
            <Input
              type="text"
              placeholder="اكتب ملاحظات المعلم هنا..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className={styles.feedbackInput}
            />
          </div>
        </div>

        <div className={styles.formFooter}>
          {/* File Upload Input */}
          <div className={styles.uploadArea}>
            <input
              type="file"
              id={`feedback-file-${sub.id}`}
              onChange={(e) => {
                setFile(e.target.files[0] || null);
                if (e.target.files[0]) {
                  setDeleteFileFlag(false);
                }
              }}
              className={styles.hiddenInput}
              accept="image/*,.pdf"
            />
            <label
              htmlFor={`feedback-file-${sub.id}`}
              className={styles.uploadBtn}
            >
              <IconUpload size={14} />
              <span>{file ? 'تغيير الصورة' : 'إرفاق صورة...'}</span>
            </label>
            {file && (
              <span className={styles.fileName} title={file.name}>
                {file.name}
              </span>
            )}
          </div>

          <div className={styles.buttonGroup}>
            {isChanged && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setGrade(sub.grade ?? '');
                  setFeedback(sub.feedback ?? '');
                  setFile(null);
                  setDeleteFileFlag(false);
                }}
                disabled={saving}
              >
                إلغاء
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              disabled={!isChanged || saving}
              onClick={handleSave}
            >
              {saving ? 'جاري الحفظ...' : 'حفظ التقييم'}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
