"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// This page has been disabled for security reasons.
// Admin accounts should be created via the database directly.
export default function AdminSetup() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <p style={{ textAlign: 'center', color: 'var(--ink-muted)' }}>
          هذه الصفحة غير متاحة. جاري التحويل...
        </p>
      </div>
    </div>
  );
}
