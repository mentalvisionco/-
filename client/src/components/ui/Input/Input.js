'use client';
import styles from './Input.module.css';

export default function Input({
  label,
  error,
  helper,
  icon: Icon = null,
  size = 'md',
  fullWidth = true,
  className = '',
  id,
  ...props
}) {
  const inputId = id || (label ? label.replace(/\s+/g, '-').toLowerCase() : undefined);

  return (
    <div className={`${styles.group} ${fullWidth ? styles.fullWidth : ''} ${className}`}>
      {label && <label htmlFor={inputId} className={styles.label}>{label}</label>}
      <div className={`${styles.inputWrapper} ${error ? styles.hasError : ''} ${styles[size]} ${Icon ? styles.hasIcon : ''}`}>
        {Icon && <Icon size={16} className={styles.iconSlot} />}
        <input
          id={inputId}
          className={styles.input}
          {...props}
        />
      </div>
      {error && <span className={styles.error}>{error}</span>}
      {helper && !error && <span className={styles.helper}>{helper}</span>}
    </div>
  );
}

