import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="not-found-wrapper">
      <div className="not-found-code">404</div>
      <h2 className="not-found-title">الصفحة غير موجودة</h2>
      <p className="not-found-desc">
        عذرًا، الصفحة التي تبحث عنها غير موجودة أو تم نقلها.
      </p>
      <Link href="/" className="not-found-btn">
        العودة للرئيسية
      </Link>
    </div>
  );
}
