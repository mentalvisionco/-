// ملف مساعد للاتصال بالخادم (Backend)
const API_URL = '/api';

// إدارة الـ Token
function setToken(token) {
  localStorage.setItem('lms_token', token);
}

function getToken() {
  return localStorage.getItem('lms_token');
}

function logout() {
  localStorage.removeItem('lms_token');
  localStorage.removeItem('currentUser');
  window.location.href = 'index.html';
}

function setCurrentUser(user) {
  localStorage.setItem('currentUser', JSON.stringify(user));
}

function getCurrentUser() {
  const user = localStorage.getItem('currentUser');
  return user ? JSON.parse(user) : null;
}

// دالة أساسية لطلبات الـ API
async function apiCall(endpoint, method = 'GET', body = null) {
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

// إظهار إشعارات (Toasts)
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if(!toast) return;
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  
  setTimeout(() => {
    toast.className = 'toast';
  }, 3000);
}
