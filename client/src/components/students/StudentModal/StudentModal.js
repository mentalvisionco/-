'use client';
import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal/Modal';
import Input from '@/components/ui/Input/Input';
import Button from '@/components/ui/Button/Button';
import styles from './StudentModal.module.css';

export default function StudentModal({
  isOpen,
  onClose,
  editId,
  initialData,
  onSave,
}) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    points: 0,
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (editId && initialData) {
        setFormData({
          name: initialData.name || '',
          email: initialData.email || '',
          password: '', // Optional on edit
          points: initialData.points || 0,
        });
      } else {
        setFormData({
          name: '',
          email: '',
          password: '',
          points: 0,
        });
      }
      setErrors({});
      setIsSubmitting(false);
    }
  }, [isOpen, editId, initialData]);

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'الاسم مطلوب';
    if (!formData.email.trim()) {
      newErrors.email = 'البريد الإلكتروني مطلوب';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'صيغة البريد الإلكتروني غير صحيحة';
    }
    
    if (!editId && !formData.password) {
      newErrors.password = 'كلمة المرور مطلوبة';
    } else if (formData.password && formData.password.length < 8) {
      newErrors.password = 'يجب أن تكون كلمة المرور 8 أحرف على الأقل';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field) => (e) => {
    setFormData({ ...formData, [field]: e.target.value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: null });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    
    setIsSubmitting(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      // Assuming onSave throws on API error, the catch can handle any modal specific things if needed.
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEditMode = !!editId;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? 'تعديل بيانات الطالب' : 'إضافة طالب جديد'}
      size="md"
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        {isEditMode && (
          <div className={styles.editIndicator}>
            <span className={styles.editBadge}>وضع التعديل</span>
            <p>أنت الآن تقوم بتعديل بيانات الطالب <strong>{initialData?.name}</strong></p>
          </div>
        )}

        <div className={styles.fields}>
          <div className={styles.fieldGroup}>
            <Input
              label="اسم الطالب"
              type="text"
              value={formData.name}
              onChange={handleChange('name')}
              placeholder="أدخل اسم الطالب الثلاثي"
              disabled={isSubmitting}
            />
            {errors.name && <span className={styles.error}>{errors.name}</span>}
          </div>

          <div className={styles.fieldGroup}>
            <Input
              label="البريد الإلكتروني"
              type="email"
              value={formData.email}
              onChange={handleChange('email')}
              placeholder="student@example.com"
              dir="ltr"
              disabled={isSubmitting}
            />
            {errors.email && <span className={styles.error}>{errors.email}</span>}
          </div>

          <div className={styles.fieldGroup}>
            <Input
              label={isEditMode ? 'كلمة المرور الجديدة (اختياري)' : 'كلمة المرور'}
              type="password"
              value={formData.password}
              onChange={handleChange('password')}
              placeholder="••••••••"
              dir="ltr"
              disabled={isSubmitting}
            />
            {isEditMode && !errors.password && (
              <span className={styles.hint}>اترك الحقل فارغاً للاحتفاظ بكلمة المرور القديمة</span>
            )}
            {errors.password && <span className={styles.error}>{errors.password}</span>}
          </div>

          <div className={styles.fieldGroup}>
            <Input
              label="النقاط الافتتاحية"
              type="number"
              value={formData.points}
              onChange={handleChange('points')}
              placeholder="0"
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div className={styles.actions}>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
          >
            إلغاء
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'جاري الحفظ...' : (isEditMode ? 'حفظ التعديلات' : 'إضافة الطالب')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
