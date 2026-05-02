export const API_URL = 'http://localhost:5000/api';

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

export function logout() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('lms_token');
    localStorage.removeItem('currentUser');
    window.location.href = '/';
  }
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

  try {
    const res = await fetch(`${API_URL}${endpoint}`, config);
    const data = await res.json();
    
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        logout(); // Token expired or invalid
      }
      throw new Error(data.error || 'حدث خطأ غير معروف');
    }
    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

export function showToast(message, type = 'success') {
  if (typeof window === 'undefined') return;
  const toast = document.getElementById('toast');
  if(!toast) return;
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  
  setTimeout(() => {
    toast.className = 'toast';
  }, 3000);
}
