"use client";

import { useState } from 'react';
import Link from 'next/link';
import { apiCall, showToast } from '@/lib/api';

export default function AdminSetup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiCall('/register', 'POST', { name, email, password, role: 'admin' });
      showToast('تم تسجيل حساب المدير بنجاح!', 'success');
      
      // Reset form
      setName('');
      setEmail('');
      setPassword('');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <img src="/logo.svg" alt="Mental Vision" className="logo-img" />
          <p style={{ textAlign: 'center' }}>أنشئ حسابات الإدارة من هنا</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>اسم المدير</label>
            <input 
              type="text" 
              className="form-control" 
              required 
              placeholder="اسم المدير"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>البريد الإلكتروني</label>
            <input 
              type="email" 
              className="form-control" 
              required 
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>كلمة المرور</label>
            <input 
              type="password" 
              className="form-control" 
              required 
              minLength="3" 
              placeholder="3 أحرف على الأقل"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" className="btn" style={{ background: 'var(--indigo)' }} disabled={loading}>
            {loading ? 'جاري التحميل...' : 'تسجيل كمدير'}
          </button>
        </form>
        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <Link href="/" style={{ color: 'var(--accent)', fontWeight: '600' }}>
            ← الرجوع للرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}
