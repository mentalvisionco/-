'use client';
import { useEffect, useCallback, useState } from 'react';
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
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  const handleEsc = useCallback((e) => {
    if (e.key === 'Escape') onClose?.();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsAnimatingOut(false);
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    } else if (shouldRender) {
      setIsAnimatingOut(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsAnimatingOut(false);
      }, 300); // matching exit animation duration
      return () => clearTimeout(timer);
    }

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isOpen, shouldRender, handleEsc]);

  if (!shouldRender) return null;

  const modal = (
    <div className={`${styles.overlay} ${isAnimatingOut ? styles.overlayOut : ''}`} onClick={onClose}>
      <div
        className={`${styles.modal} ${styles[size]} ${isAnimatingOut ? styles.modalOut : ''} ${className}`}
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

