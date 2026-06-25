import axios from 'axios';

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

const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Crucial for cookie transmission
  headers: {
    'X-Requested-With': 'XMLHttpRequest' // Custom header for CSRF
  }
});

// Request Interceptor: Attach Token
apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response Interceptor: Handle Refresh Token
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry && getToken()) {
      if (isRefreshing) {
        return new Promise(function(resolve, reject) {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers['Authorization'] = 'Bearer ' + token;
          return apiClient(originalRequest);
        }).catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post(`${API_URL}/auth/refresh`, {}, {
          withCredentials: true,
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        
        const newAccessToken = res.data.accessToken;
        setToken(newAccessToken);
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
        
        processQueue(null, newAccessToken);
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('lms_token');
          localStorage.removeItem('currentUser');
          window.location.href = '/';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    if (error.response?.status === 401 || error.response?.status === 403) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('lms_token');
        localStorage.removeItem('currentUser');
        window.location.href = '/';
      }
    }

    const errorMessage = error.response?.data?.error || error.message || 'حدث خطأ غير معروف';
    return Promise.reject(new Error(errorMessage));
  }
);

// Unified apiCall wrapper to maintain backward compatibility with existing code
export async function apiCall(endpoint, method = 'GET', body = null, onUploadProgress = null) {
  const config = {
    method,
    url: endpoint,
    data: body,
  };

  if (onUploadProgress) {
    config.onUploadProgress = (progressEvent) => {
      if (progressEvent.lengthComputable) {
        const percentComplete = Math.round((progressEvent.loaded / progressEvent.total) * 100);
        onUploadProgress(percentComplete);
      }
    };
  }

  const response = await apiClient(config);
  return response.data;
}
