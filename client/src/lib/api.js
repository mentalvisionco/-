const isDevelopment = process.env.NODE_ENV === 'development';
export const API_URL = process.env.NEXT_PUBLIC_API_URL || (isDevelopment ? 'http://localhost:5000/api' : '/api');

export function setToken(token) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('lms_token', token);
  }
}

export function getToken() {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('lms_token');
  }
  return null;
}

export function setCurrentUser(user) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('currentUser', JSON.stringify(user));
  }
}

export function getCurrentUser() {
  if (typeof window !== 'undefined') {
    const user = localStorage.getItem('currentUser');
    return user ? JSON.parse(user) : null;
  }
  return null;
}

export async function apiCall(endpoint, method = 'GET', body = null) {
  const headers = {
    'Content-Type': 'application/json'
  };

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    method,
    headers
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_URL}${endpoint}`, config);
  const data = await res.json();

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('lms_token');
        localStorage.removeItem('currentUser');
        window.location.href = '/';
      }
    }
    throw new Error(data.error || 'حدث خطأ غير معروف');
  }
  return data;
}
