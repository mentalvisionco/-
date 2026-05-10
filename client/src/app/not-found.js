import Link from 'next/link';
import styles from './not-found.module.css';

export default function NotFound() {
  return (
    <div className={styles.wrapper}>
      <div className={styles.code}>404</div>
      <h2 className={styles.title}>الصفحة غير موجودة</h2>
      <p className={styles.desc}>عذرًا، الصفحة التي تبحث عنها غير موجودة أو تم نقلها.</p>
      <Link href="/" className={styles.btn}>العودة للرئيسية</Link>
    </div>
  );
}
