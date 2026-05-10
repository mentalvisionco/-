'use client';
import styles from './LectureForm.module.css';
import Input from '@/components/ui/Input/Input';
import Button from '@/components/ui/Button/Button';
import Card from '@/components/ui/Card/Card';

export default function LectureForm({ editId, title, desc, materialUrl, onTitleChange, onDescChange, onUrlChange, onSave, onCancel }) {
  return (
    <Card padding="md" animate className={styles.form}>
      <h4 className={styles.heading}>{editId ? 'تعديل المحاضرة' : 'إضافة محاضرة جديدة'}</h4>
      <form onSubmit={onSave} className={styles.fields}>
        <Input label="عنوان المحاضرة" type="text" required value={title} onChange={e => onTitleChange(e.target.value)} placeholder="أدخل عنوان المحاضرة" />
        <Input label="الوصف" type="text" value={desc} onChange={e => onDescChange(e.target.value)} placeholder="وصف مختصر (اختياري)" />
        <Input label="رابط الماتيريال" type="url" required value={materialUrl} onChange={e => onUrlChange(e.target.value)} placeholder="https://..." />
        <div className={styles.actions}>
          <Button type="submit" variant="primary">حفظ</Button>
          <Button type="button" variant="secondary" onClick={onCancel}>إلغاء</Button>
        </div>
      </form>
    </Card>
  );
}
