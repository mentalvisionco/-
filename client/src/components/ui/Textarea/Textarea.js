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
  const textareaId = id || (label ? label.replace(/\s+/g, '-').toLowerCase() : undefined);

  return (
    <div className={`${styles.group} ${fullWidth ? styles.fullWidth : ''} ${className}`}>
      {label && <label htmlFor={textareaId} className={styles.label}>{label}</label>}
      <textarea
        id={textareaId}
        className={`${styles.textarea} ${error ? styles.hasError : ''}`}
        rows={rows}
        {...props}
      />
      {error && <span className={styles.error}>{error}</span>}
      {helper && !error && <span className={styles.helper}>{helper}</span>}
    </div>
  );
}
