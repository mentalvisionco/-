'use client';
import { useState } from 'react';
import styles from './TaskCard.module.css';
import Badge from '@/components/ui/Badge/Badge';
import Button from '@/components/ui/Button/Button';
import Input from '@/components/ui/Input/Input';
import { IconExternalLink, IconCheck, IconUpload } from '@/components/icons';

export default function TaskCard({ task, submission, onSubmit }) {
  const isCompleted = !!submission;
  const [url, setUrl] = useState(submission?.fileUrl || '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(task.id, url);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`${styles.card} ${isCompleted ? styles.completed : ''}`}>
      <div className={styles.header}>
        <div className={styles.info}>
          <h4 className={styles.title}>{task.title}</h4>
          {task.description && <p className={styles.desc}>{task.description}</p>}
        </div>
        <Badge variant={isCompleted ? 'success' : 'danger'} dot>
          {isCompleted ? 'تم التسليم' : 'لم يتم التسليم'}
        </Badge>
      </div>

      <a href={task.taskUrl} target="_blank" rel="noopener noreferrer" className={styles.taskLink}>
        <IconExternalLink size={14} />
        <span>عرض تفاصيل المهمة</span>
      </a>

      <form onSubmit={handleSubmit} className={styles.form}>
        <Input
          label="رابط الإنجاز (Drive / Github)"
          type="url"
          required
          placeholder="https://..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          size="md"
        />
        <Button
          type="submit"
          variant={isCompleted ? 'secondary' : 'primary'}
          size="md"
          loading={submitting}
          icon={isCompleted ? IconCheck : IconUpload}
        >
          {isCompleted ? 'تحديث التسليم' : 'تسليم المهمة'}
        </Button>
      </form>
    </div>
  );
}
