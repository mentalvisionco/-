document.addEventListener('DOMContentLoaded', async () => {
  const user = getCurrentUser();
  if (!user || user.role !== 'admin') {
    logout();
    return;
  }

  // Navigation Setup
  const views = {
    dashboard: document.getElementById('viewDashboard'),
    students: document.getElementById('viewStudents'),
    lectures: document.getElementById('viewLectures')
  };
  const navs = {
    dashboard: document.getElementById('navDashboard'),
    students: document.getElementById('navStudents'),
    lectures: document.getElementById('navLectures')
  };

  function switchView(viewName) {
    Object.values(views).forEach(v => v.classList.add('hidden'));
    Object.values(navs).forEach(n => n.classList.remove('active'));
    views[viewName].classList.remove('hidden');
    navs[viewName].classList.add('active');
  }

  navs.dashboard.addEventListener('click', () => switchView('dashboard'));
  navs.students.addEventListener('click', () => switchView('students'));
  navs.lectures.addEventListener('click', () => switchView('lectures'));

  try {
    // Fetch Data
    const [students, submissions, lectures] = await Promise.all([
      apiCall('/admin/students'),
      apiCall('/admin/submissions'),
      apiCall('/lectures')
    ]);

    const totalLectures = lectures.length || 1;

    // Dashboard Stats
    document.getElementById('totalStudents').textContent = students.length;
    document.getElementById('totalSubmissions').textContent = submissions.length;
    const totalExpected = students.length * totalLectures;
    const avgEng = totalExpected > 0 ? Math.round((submissions.length / totalExpected) * 100) : 0;
    document.getElementById('avgEngagement').textContent = `${avgEng}%`;

    // Recent Submissions
    const recentSubmissionsList = document.getElementById('recentSubmissions');
    if (submissions.length === 0) {
      recentSubmissionsList.innerHTML = '<p style="color: var(--text-muted); padding: 1rem;">لا توجد تسليمات حتى الآن.</p>';
    } else {
      recentSubmissionsList.innerHTML = '';
      submissions.slice(0, 5).forEach(sub => {
        recentSubmissionsList.innerHTML += `
          <div class="list-item">
            <div>
              <h4 style="color: var(--text-main); margin-bottom: 0.25rem;">${sub.studentName} - ${sub.lectureTitle}</h4>
              <small><a href="${sub.fileUrl}" target="_blank" rel="noopener" style="color: var(--primary)">عرض الملف المسلم</a></small>
            </div>
            <span class="badge success">تم التسليم</span>
          </div>
        `;
      });
    }

    // Students Table
    const tbody = document.getElementById('studentsTableBody');
    if (students.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="padding: 2rem; color: var(--text-muted); text-align: center;">لا يوجد طلاب مسجلين حتى الآن.</td></tr>';
    } else {
      tbody.innerHTML = '';
      students.forEach(student => {
        const score = (student.submissionsCount * 10) + (student.points || 0);
        let scoreBadge = 'danger';
        if (score >= 100) scoreBadge = 'success';
        else if (score >= 50) scoreBadge = 'warning';

        tbody.innerHTML += `
          <tr>
            <td>${student.name}</td>
            <td style="color: var(--text-muted);">${student.email}</td>
            <td>${student.points || 0}</td>
            <td>${student.submissionsCount} / ${totalLectures}</td>
            <td><span class="badge ${scoreBadge}">${score} نقطة</span></td>
          </tr>
        `;
      });
    }

    // Lectures Management
    const list = document.getElementById('adminLecturesList');
    if (lectures.length === 0) {
      list.innerHTML = '<p style="color: var(--text-muted); padding: 1rem;">لا توجد محاضرات. أضف محاضرة جديدة.</p>';
    } else {
      list.innerHTML = '';
      lectures.forEach(lec => {
        list.innerHTML += `
          <div class="list-item">
            <div>
              <h4 style="color: var(--text-main); margin-bottom: 0.25rem;">${lec.title}</h4>
              <small>${lec.description || ''}</small>
            </div>
            <div>
              <button class="btn" style="width: auto; padding: 0.5rem 1rem; background: linear-gradient(135deg, var(--warning), #d97706); color: #000;">تعديل</button>
            </div>
          </div>
        `;
      });
    }

  } catch (error) {
    showToast('خطأ في جلب بيانات الإدارة', 'error');
  }
});
