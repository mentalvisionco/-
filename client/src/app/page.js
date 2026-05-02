"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiCall, setToken, setCurrentUser, getCurrentUser, getToken, showToast } from '@/lib/api';

export default function AuthPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);

  // Form State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  useEffect(() => {
    // Check if already logged in
    const currentUser = getCurrentUser();
    const token = getToken();
    if (currentUser && token) {
      redirectUser(currentUser.role);
    }
  }, []);

  const redirectUser = (role) => {
    if (role === 'admin') {
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

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await apiCall('/register', 'POST', { 
        name: regName, 
        email: regEmail, 
        password: regPassword, 
        role: 'student' 
      });
      setToken(data.token);
      setCurrentUser(data.user);
      showToast('تم إنشاء الحساب بنجاح!', 'success');
      setTimeout(() => redirectUser(data.user.role), 1000);
    } catch (error) {
      showToast(error.message, 'error');
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      {/* Login Card */}
      {isLogin ? (
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
          <div className="auth-switch">
            ليس لديك حساب؟{' '}
            <a href="#" onClick={(e) => { e.preventDefault(); setIsLogin(false); }}>
              أنشئ واحدًا
            </a>
          </div>
        </div>
      ) : (
        /* Register Card */
        <div className="auth-card" id="registerCard">
          <div className="auth-header">
            <img src="/logo.svg" alt="Mental Vision" className="logo-img" />
            <p style={{ textAlign: 'center' }}>انضم إلى المنصة وابدأ التعلّم</p>
          </div>
          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label>الاسم الكامل</label>
              <input 
                type="text" 
                className="form-control" 
                required 
                placeholder="اسمك الكامل"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>البريد الإلكتروني</label>
              <input 
                type="email" 
                className="form-control" 
                required 
                placeholder="name@example.com"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
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
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
              />
            </div>
            <button type="submit" className="btn" disabled={loading}>
              {loading ? 'جاري التحميل...' : 'إنشاء الحساب'}
            </button>
          </form>
          <div className="auth-switch">
            لديك حساب بالفعل؟{' '}
            <a href="#" onClick={(e) => { e.preventDefault(); setIsLogin(true); }}>
              سجّل الدخول
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
