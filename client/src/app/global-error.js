"use client";

export default function GlobalError({ error, reset }) {
  return (
    <html lang="ar" dir="rtl">
      <body style={{
        fontFamily: "'IBM Plex Sans Arabic', sans-serif",
        backgroundColor: '#0A1C23',
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        margin: 0
      }}>
        <div style={{
          textAlign: 'center',
          padding: '2rem',
          maxWidth: '400px'
        }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>حدث خطأ غير متوقع</h2>
          <p style={{ color: '#9BAEBA', marginBottom: '1.5rem', lineHeight: '1.7' }}>
            عذرًا، حدث خطأ في التطبيق. يرجى المحاولة مرة أخرى.
          </p>
          <button
            onClick={reset}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#FFFFFF',
              color: '#0A1C23',
              border: 'none',
              borderRadius: '10px',
              fontWeight: '600',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '0.93rem'
            }}
          >
            إعادة المحاولة
          </button>
        </div>
      </body>
    </html>
  );
}
