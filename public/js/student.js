document.addEventListener('DOMContentLoaded', async () => {
  const user = getCurrentUser();
  if (!user || user.role !== 'student') {
    logout();
    return;
  }

  // Set User Data
  document.getElementById('welcomeMsg').textContent = `مرحباً، ${user.name.split(' ')[0]}!`;
  document.getElementById('userAvatar').textContent = user.name.charAt(0);
  document.getElementById('userPoints').textContent = user.points || 0;

  // Navigation Setup
  const views = {
    home: document.getElementById('viewHome'),
    lectures: document.getElementById('viewLectures'),
    singleLecture: document.getElementById('viewSingleLecture')
  };
  const navs = {
    home: document.getElementById('navHome'),
    lectures: document.getElementById('navLectures'),
  };

  function switchView(viewName) {
    Object.values(views).forEach(v => v.classList.add('hidden'));
    Object.values(navs).forEach(n => n.classList.remove('active'));
    views[viewName].classList.remove('hidden');
    if(navs[viewName]) navs[viewName].classList.add('active');
  }

  navs.home.addEventListener('click', () => switchView('home'));
  navs.lectures.addEventListener('click', () => { renderAllLectures(); switchView('lectures'); });
  document.getElementById('backToLectures').addEventListener('click', () => switchView('lectures'));

  // Data State
  let lectures = [];
  let submissions = [];

  // Fetch Data from Server
  try {
    const [meRes, lecsRes, subsRes] = await Promise.all([
      apiCall('/me'),
      apiCall('/lectures'),
      apiCall('/submissions/me')
    ]);
    
    // Update local user points from server (source of truth)
    user.points = meRes.points;
    setCurrentUser(user);
    document.getElementById('userPoints').textContent = user.points;

    lectures = lecsRes;
    submissions = subsRes;

    updateStats();
    renderRecentLectures();

  } catch (error) {
    showToast('خطأ في جلب البيانات', 'error');
  }

  function updateStats() {
    // Use actual lecture count from server instead of hardcoded 10
    const totalLectures = lectures.length || 1;
    const completed = submissions.length;
    const progressPercent = Math.min(Math.round((completed / totalLectures) * 100), 100);
    
    document.getElementById('progressVal').textContent = `${progressPercent}%`;
    document.getElementById('progressBar').style.width = `${progressPercent}%`;
    document.getElementById('lecturesCompleted').textContent = `${completed} / ${totalLectures}`;
    document.getElementById('tasksSubmitted').textContent = completed;
  }

  function renderRecentLectures() {
    const list = document.getElementById('recentLecturesList');
    
    if (lectures.length === 0) {
      list.innerHTML = '<p style="color: var(--text-muted); padding: 1rem;">لا توجد محاضرات متاحة حالياً.</p>';
      return;
    }

    list.innerHTML = '';
    lectures.slice(0, 3).forEach(lec => {
      const isCompleted = submissions.some(s => s.lectureId === lec.id);
      list.innerHTML += `
        <div class="list-item" onclick="openLecture(${lec.id})">
          <div>
            <h4 style="color: var(--text-main); margin-bottom: 0.25rem;">${lec.title}</h4>
            <small>${lec.description || ''}</small>
          </div>
          <span class="badge ${isCompleted ? 'success' : 'warning'}">${isCompleted ? 'مكتملة' : 'قيد الانتظار'}</span>
        </div>
      `;
    });
  }

  function renderAllLectures() {
    const list = document.getElementById('allLecturesList');
    
    if (lectures.length === 0) {
      list.innerHTML = '<p style="color: var(--text-muted); padding: 1rem;">لا توجد محاضرات متاحة حالياً.</p>';
      return;
    }

    list.innerHTML = '';
    lectures.forEach(lec => {
      const isCompleted = submissions.some(s => s.lectureId === lec.id);
      list.innerHTML += `
        <div class="list-item" onclick="openLecture(${lec.id})">
          <div>
            <h4 style="color: var(--text-main); margin-bottom: 0.25rem;">${lec.title}</h4>
            <small>${lec.description || ''}</small>
          </div>
          <span class="badge ${isCompleted ? 'success' : 'danger'}">${isCompleted ? 'تم التسليم' : 'لم يتم التسليم'}</span>
        </div>
      `;
    });
  }

  window.openLecture = function(id) {
    const lec = lectures.find(l => l.id === id);
    if (!lec) {
      showToast('المحاضرة غير متاحة', 'warning');
      return;
    }

    document.getElementById('lectureTitle').textContent = lec.title;
    document.getElementById('lectureDesc').textContent = lec.description || '';
    document.getElementById('currentLectureId').value = id;
    
    // Fill previous submission if exists
    const existingSub = submissions.find(s => s.lectureId === id);
    document.getElementById('taskUrl').value = existingSub ? existingSub.fileUrl : '';
    
    switchView('singleLecture');
  };

  // Handle Task Submission via API
  document.getElementById('taskForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const lecId = parseInt(document.getElementById('currentLectureId').value);
    const url = document.getElementById('taskUrl').value;
    
    try {
      const res = await apiCall('/submissions', 'POST', { lectureId: lecId, fileUrl: url });
      showToast(res.message, 'success');
      
      // Refresh data instead of full page reload
      const [meRes, subsRes] = await Promise.all([
        apiCall('/me'),
        apiCall('/submissions/me')
      ]);
      
      user.points = meRes.points;
      setCurrentUser(user);
      document.getElementById('userPoints').textContent = user.points;
      submissions = subsRes;
      updateStats();
      
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

});
