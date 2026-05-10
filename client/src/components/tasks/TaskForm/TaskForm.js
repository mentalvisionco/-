'use client';
import styles from './TaskForm.module.css';
import Input from '@/components/ui/Input/Input';
import Button from '@/components/ui/Button/Button';
import Card from '@/components/ui/Card/Card';

export default function TaskForm({ editId, title, desc, taskUrl, onTitleChange, onDescChange, onUrlChange, onSave, onCancel }) {
  return (
    <Card padding="md" animate className={styles.form}>
      <h4 className={styles.heading}>{editId ? 'تعديل المهمة' : 'إضافة مهمة جديدة'}</h4>
      <form onSubmit={onSave} className={styles.fields}>
        <Input label="عنوان المهمة" type="text" required value={title} onChange={e => onTitleChange(e.target.value)} placeholder="أدخل عنوان المهمة" />
        <Input label="الوصف" type="text" value={desc} onChange={e => onDescChange(e.target.value)} placeholder="وصف مختصر (اختياري)" />
        <Input label="رابط المهمة (تفاصيل الواجب)" type="url" required value={taskUrl} onChange={e => onUrlChange(e.target.value)} placeholder="https://..." />
        <div className={styles.actions}>
          <Button type="submit" variant="primary">حفظ</Button>
          <Button type="button" variant="secondary" onClick={onCancel}>إلغاء</Button>
        </div>
      </form>
    </Card>
  );
}
