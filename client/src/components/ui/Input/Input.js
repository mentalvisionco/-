'use client';
import { useState } from 'react';
import styles from './Input.module.css';
import { IconEye } from '@/components/icons';

export default function Input({
  label,
  error,
  helper,
  icon: Icon = null,
  size = 'md',
  fullWidth = true,
  className = '',
  id,
  type = 'text',
  ...props
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const actualType = isPassword ? (showPassword ? 'text' : 'password') : type;

  const inputId = id || (label ? label.replace(/[^\w\s\u0600-\u06FF-]/g, '').trim().replace(/\s+/g, '-').toLowerCase() : undefined);
  const errorId = error ? `${inputId}-error` : undefined;
  const helperId = helper ? `${inputId}-helper` : undefined;
  const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`${styles.group} ${fullWidth ? styles.fullWidth : ''} ${className}`}>
      {label && <label htmlFor={inputId} className={styles.label}>{label}</label>}
      <div className={`${styles.inputWrapper} ${error ? styles.hasError : ''} ${styles[size]} ${Icon ? styles.hasIcon : ''} ${isPassword ? styles.hasPasswordToggle : ''}`}>
        {Icon && <Icon size={16} className={styles.iconSlot} />}
        <input
          id={inputId}
          type={actualType}
          className={styles.input}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            className={styles.passwordToggle}
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={0}
            aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
          >
            <IconEye size={16} className={showPassword ? styles.activeEye : ''} />
          </button>
        )}
      </div>
      {error && <span id={errorId} className={styles.error} role="alert">{error}</span>}
      {helper && !error && <span id={helperId} className={styles.helper}>{helper}</span>}
    </div>
  );
}

