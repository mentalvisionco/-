"use client";

import styles from './error.module.css';

export default function Error({ reset }) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.icon}>⚠️</div>
        <h2 className={styles.title}>حدث خطأ</h2>
        <p className={styles.desc}>عذرًا، حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.</p>
        <button className={styles.btn} onClick={reset}>إعادة المحاولة</button>
      </div>
    </div>
  );
}
