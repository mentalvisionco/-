"use client";

import "./globals.css";

export default function Error({ error, reset }) {
  return (
    <div className="auth-wrapper">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <h2 style={{ marginBottom: '1rem' }}>حدث خطأ</h2>
        <p style={{ color: 'var(--ink-muted)', marginBottom: '1.5rem' }}>
          عذرًا، حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.
        </p>
        <button className="btn" onClick={reset} style={{ maxWidth: '200px', margin: '0 auto' }}>
          إعادة المحاولة
        </button>
      </div>
    </div>
  );
}
