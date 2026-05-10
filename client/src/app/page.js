"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiCall, setToken, setCurrentUser, getCurrentUser, getToken, showToast } from '@/lib/api';

export default function AuthPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  // Form State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  useEffect(() => {
    // Check if already logged in
    const currentUser = getCurrentUser();
    const token = getToken();
    if (currentUser && token) {
      redirectUser(currentUser.role);
    }
  }, []);

  const redirectUser = (role) => {
    if (role === 'admin' || role === 'viewer') {
      router.push('/admin');
    } else {
      router.push('/student');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await apiCall('/login', 'POST', { email: loginEmail, password: loginPassword });
      setToken(data.token);
      setCurrentUser(data.user);
      showToast('تم تسجيل الدخول بنجاح!', 'success');
      setTimeout(() => redirectUser(data.user.role), 1000);
    } catch (error) {
      showToast(error.message, 'error');
      setLoading(false);
    }
  };



  return (
    <div className="auth-wrapper">
      {/* Login Card */}
      <div className="auth-card" id="loginCard">
          <div className="auth-header">
            <img src="/logo.svg" alt="Mental Vision" className="logo-img" />
            <p style={{ textAlign: 'center' }}>سجّل دخولك لمتابعة رحلتك التدريبية</p>
          </div>
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>البريد الإلكتروني</label>
              <input 
                type="email" 
                className="form-control" 
                required 
                placeholder="name@example.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>كلمة المرور</label>
              <input 
                type="password" 
                className="form-control" 
                required 
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
              />
            </div>
            <button type="submit" className="btn" disabled={loading}>
              {loading ? 'جاري التحميل...' : 'تسجيل الدخول'}
            </button>
          </form>
        </div>
    </div>
  );
}
