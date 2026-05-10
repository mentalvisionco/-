'use client';
import Modal from '@/components/ui/Modal/Modal';
import Button from '@/components/ui/Button/Button';
import styles from './ConfirmDialog.module.css';
import { IconAlertCircle } from '@/components/icons';

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'تأكيد',
  message = 'هل أنت متأكد من هذا الإجراء؟',
  confirmLabel = 'تأكيد',
  cancelLabel = 'إلغاء',
  variant = 'danger',
  loading = false,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" showClose={false}>
      <div className={styles.content}>
        <div className={`${styles.iconWrap} ${styles[variant]}`}>
          <IconAlertCircle size={24} />
        </div>
        <h4 className={styles.title}>{title}</h4>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
