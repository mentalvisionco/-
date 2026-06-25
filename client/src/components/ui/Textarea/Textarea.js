'use client';
import styles from './Textarea.module.css';

export default function Textarea({
  label,
  error,
  helper,
  fullWidth = true,
  className = '',
  id,
  rows = 3,
  ...props
}) {
  const textareaId = id || (label ? label.replace(/[^\w\s\u0600-\u06FF-]/g, '').trim().replace(/\s+/g, '-').toLowerCase() : undefined);
  const errorId = error ? `${textareaId}-error` : undefined;
  const helperId = helper ? `${textareaId}-helper` : undefined;
  const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`${styles.group} ${fullWidth ? styles.fullWidth : ''} ${className}`}>
      {label && <label htmlFor={textareaId} className={styles.label}>{label}</label>}
      <textarea
        id={textareaId}
        className={`${styles.textarea} ${error ? styles.hasError : ''}`}
        rows={rows}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        {...props}
      />
      {error && <span id={errorId} className={styles.error} role="alert">{error}</span>}
      {helper && !error && <span id={helperId} className={styles.helper}>{helper}</span>}
    </div>
  );
}
