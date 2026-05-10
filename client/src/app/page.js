"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { apiCall } from '@/lib/api';
import Button from '@/components/ui/Button/Button';
import Input from '@/components/ui/Input/Input';
import Image from 'next/image';
import styles from './page.module.css';

export default function AuthPage() {
  const router = useRouter();
  const { user, login: authLogin, ready } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (ready && user) {
      if (user.role === 'admin' || user.role === 'viewer') {
        router.push('/admin');
      } else {
        router.push('/student');
      }
    }
  }, [ready, user, router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await apiCall('/login', 'POST', { email, password });
      authLogin(data.user, data.token);
      toast.success('تم تسجيل الدخول بنجاح!');
      setTimeout(() => {
        if (data.user.role === 'admin' || data.user.role === 'viewer') {
          router.push('/admin');
        } else {
          router.push('/student');
        }
      }, 600);
    } catch (error) {
      toast.error(error.message);
      setLoading(false);
    }
  };

  if (!ready) return null;

  return (
    <div className={styles.wrapper}>
      <div className={styles.bgGlow} />
      <div className={styles.bgGlow2} />

      <div className={styles.card}>
        <div className={styles.header}>
          <Image src="/logo.svg" alt="Mental Vision" width={140} height={46} className={styles.logo} priority />
          <p className={styles.subtitle}>سجّل دخولك لمتابعة رحلتك التدريبية</p>
        </div>

        <form onSubmit={handleLogin} className={styles.form}>
          <Input
            label="البريد الإلكتروني"
            type="email"
            required
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            size="lg"
          />
          <Input
            label="كلمة المرور"
            type="password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            size="lg"
          />
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={loading}
          >
            تسجيل الدخول
          </Button>
        </form>

        <div className={styles.footer}>
          <span>منصة تدريب احترافية من Mental Vision</span>
        </div>
      </div>
    </div>
  );
}
