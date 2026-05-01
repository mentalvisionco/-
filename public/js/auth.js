document.addEventListener('DOMContentLoaded', () => {
  // Check if already logged in
  const currentUser = getCurrentUser();
  const token = getToken();
  if (currentUser && token) {
    redirectUser(currentUser.role);
  }

  // UI Elements
  const loginCard = document.getElementById('loginCard');
  const registerCard = document.getElementById('registerCard');
  const showRegisterBtn = document.getElementById('showRegister');
  const showLoginBtn = document.getElementById('showLogin');

  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');

  // Toggle Forms
  showRegisterBtn.addEventListener('click', (e) => {
    e.preventDefault();
    loginCard.classList.add('hidden');
    registerCard.classList.remove('hidden');
  });

  showLoginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    registerCard.classList.add('hidden');
    loginCard.classList.remove('hidden');
  });

  // Handle Login
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
      const data = await apiCall('/login', 'POST', { email, password });
      setToken(data.token);
      setCurrentUser(data.user);
      showToast('تم تسجيل الدخول بنجاح!', 'success');
      setTimeout(() => redirectUser(data.user.role), 1000);
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  // Handle Register
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const role = document.getElementById('regRole').value;

    try {
      const data = await apiCall('/register', 'POST', { name, email, password, role });
      setToken(data.token);
      setCurrentUser(data.user);
      showToast('تم إنشاء الحساب بنجاح!', 'success');
      setTimeout(() => redirectUser(data.user.role), 1000);
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  function redirectUser(role) {
    if (role === 'admin') {
      window.location.href = 'admin.html';
    } else {
      window.location.href = 'student.html';
    }
  }
});
