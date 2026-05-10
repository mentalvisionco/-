'use client';
import { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styles from './Modal.module.css';
import { IconClose } from '@/components/icons';

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showClose = true,
  className = '',
}) {
  const handleEsc = useCallback((e) => {
    if (e.key === 'Escape') onClose?.();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleEsc]);

  if (!isOpen) return null;

  const modal = (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={`${styles.modal} ${styles[size]} ${className}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {(title || showClose) && (
          <div className={styles.header}>
            {title && <h3 className={styles.title}>{title}</h3>}
            {showClose && (
              <button className={styles.closeBtn} onClick={onClose} aria-label="إغلاق">
                <IconClose size={18} />
              </button>
            )}
          </div>
        )}
        <div className={styles.body}>
          {children}
        </div>
      </div>
    </div>
  );

  if (typeof window === 'undefined') return null;
  return createPortal(modal, document.body);
}
