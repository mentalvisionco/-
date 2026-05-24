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

let isRefreshing = false;
let refreshSubscribers = [];

function subscribeTokenRefresh(cb) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token) {
  refreshSubscribers.forEach(cb => cb(token));
  refreshSubscribers = [];
}

async function performTokenRefresh() {
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    },
    credentials: 'include'
  });
  if (!res.ok) {
    throw new Error('Refresh token invalid or expired');
  }
  const data = await res.json();
  return data.accessToken;
}

export async function apiCall(endpoint, method = 'GET', body = null, onUploadProgress = null) {
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const headers = {};

  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  // Custom header to satisfy CSRF protection on backend cookie endpoints
  headers['X-Requested-With'] = 'XMLHttpRequest';

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // If upload progress callback is provided, we must use XMLHttpRequest to track progress
  if (onUploadProgress && isFormData && method === 'POST') {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(method, `${API_URL}${endpoint}`);
      xhr.withCredentials = true; // Crucial for cookie transmission in dev environment

      // Set headers
      Object.keys(headers).forEach(key => {
        xhr.setRequestHeader(key, headers[key]);
      });

      // Track progress
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          onUploadProgress(percentComplete);
        }
      };

      xhr.onload = () => {
        let data;
        try {
          data = JSON.parse(xhr.responseText);
        } catch (e) {
          data = { error: 'حدث خطأ في الخادم' };
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data);
        } else {
          // If expired token error, enqueue and refresh
          if (xhr.status === 401 && getToken()) {
            if (!isRefreshing) {
              isRefreshing = true;
              performTokenRefresh()
                .then(newAccessToken => {
                  isRefreshing = false;
                  setToken(newAccessToken);
                  onRefreshed(newAccessToken);
                })
                .catch(err => {
                  isRefreshing = false;
                  refreshSubscribers = [];
                  if (typeof window !== 'undefined') {
                    localStorage.removeItem('lms_token');
                    localStorage.removeItem('currentUser');
                    window.location.href = '/';
                  }
                });
            }

            subscribeTokenRefresh(newAccessToken => {
              headers['Authorization'] = `Bearer ${newAccessToken}`;
              apiCall(endpoint, method, body, onUploadProgress).then(resolve).catch(reject);
            });
            return;
          }

          if (xhr.status === 401 || xhr.status === 403) {
            if (typeof window !== 'undefined') {
              localStorage.removeItem('lms_token');
              localStorage.removeItem('currentUser');
              window.location.href = '/';
            }
          }
          reject(new Error(data.error || 'حدث خطأ غير معروف'));
        }
      };

      xhr.onerror = () => {
        reject(new Error('فشل الاتصال بالخادم'));
      };

      xhr.send(body);
    });
  }

  const config = {
    method,
    headers,
    credentials: 'include' // Crucial for cookie transmission
  };

  if (body) {
    if (isFormData) {
      config.body = body;
    } else {
      config.body = JSON.stringify(body);
    }
  }

  let res;
  try {
    res = await fetch(`${API_URL}${endpoint}`, config);
  } catch (err) {
    throw new Error('فشل الاتصال بالخادم');
  }

  // Transparent token refresh for fetch
  if (res.status === 401 && getToken()) {
    if (!isRefreshing) {
      isRefreshing = true;
      performTokenRefresh()
        .then(newAccessToken => {
          isRefreshing = false;
          setToken(newAccessToken);
          onRefreshed(newAccessToken);
        })
        .catch(err => {
          isRefreshing = false;
          refreshSubscribers = [];
          if (typeof window !== 'undefined') {
            localStorage.removeItem('lms_token');
            localStorage.removeItem('currentUser');
            window.location.href = '/';
          }
        });
    }

    return new Promise((resolve, reject) => {
      subscribeTokenRefresh(newAccessToken => {
        apiCall(endpoint, method, body, onUploadProgress).then(resolve).catch(reject);
      });
    });
  }

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

