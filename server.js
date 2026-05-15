const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const { setupDB, dbGet, dbAll, dbRun } = require('./database');

// ==============================
// إعداد التطبيق
// ==============================
const app = express();
const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.SECRET_KEY;
if (!SECRET_KEY) {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL ERROR: SECRET_KEY is not defined in production environment.');
    process.exit(1);
  } else {
    console.warn('WARNING: SECRET_KEY is not defined. Using an insecure fallback for development only.');
  }
}
const ACTIVE_SECRET_KEY = SECRET_KEY || 'lms_super_secret_key_123';

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'client', 'out'), { extensions: ['html'] }));

// ==============================
// Rate Limiting
// ==============================
const rateLimit = require('express-rate-limit');
app.set('trust proxy', 1);

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: { error: 'طلبات كثيرة جداً، حاول بعد قليل' }
});

app.use('/api', apiLimiter);

// ==============================
// Health Check (مطلوب لـ Railway)
// ==============================
app.get('/health', (req, res) => {
  try {
    const result = dbGet('SELECT 1 as ok');
    if (!result || result.ok !== 1) throw new Error('DB check failed');
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'error', message: 'Database not available' });
  }
});

// ==============================
// Auth Middleware
// ==============================
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'غير مصرح لك - يرجى تسجيل الدخول' });
  }
  
  try {
    const user = jwt.verify(token, ACTIVE_SECRET_KEY);
    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'انتهت صلاحية الجلسة - يرجى إعادة تسجيل الدخول' });
  }
}

// ==============================
// Input Validation Helpers
// ==============================
function isValidUsername(username) {
  return /^[^\s]+$/.test(username);
}

function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, 500);
}

// =======================
// مسارات المصادقة (Auth)
// =======================


app.post('/api/login', (req, res) => {
  try {
    const username = sanitize(req.body.username);
    const password = req.body.password;

    if (!username || !password) {
      return res.status(400).json({ error: 'اسم المستخدم وكلمة المرور مطلوبان' });
    }

    const user = dbGet('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(400).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    const tokenPayload = { id: user.id, name: user.name, username: user.username, role: user.role };
    const token = jwt.sign(tokenPayload, ACTIVE_SECRET_KEY, { expiresIn: '24h' });

    res.json({ user: { ...tokenPayload, points: user.points }, token });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ error: 'حدث خطأ في الخادم' });
  }
});

app.get('/api/me', authenticateToken, (req, res) => {
  try {
    const user = dbGet('SELECT id, name, username, role, points, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }
    res.json(user);
  } catch (error) {
    console.error('Me error:', error.message);
    res.status(500).json({ error: 'حدث خطأ في الخادم' });
  }
});

app.put('/api/me/password', authenticateToken, (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'كلمة المرور الحالية والجديدة مطلوبتان' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل' });
    }

    const user = dbGet('SELECT password FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    const validPassword = bcrypt.compareSync(currentPassword, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة' });
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    dbRun('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.user.id]);
    res.json({ message: 'تم تغيير كلمة المرور بنجاح' });
  } catch (error) {
    console.error('Password change error:', error.message);
    res.status(500).json({ error: 'حدث خطأ في الخادم' });
  }
});

// =======================
// مسارات المحاضرات (Lectures)
// =======================
app.get('/api/lectures', authenticateToken, (req, res) => {
  try {
    const lectures = dbAll(`
      SELECT l.*, ROUND(AVG(r.rating), 1) as avgRating, COUNT(r.id) as ratingCount
      FROM lectures l
      LEFT JOIN ratings r ON l.id = r.lectureId
      GROUP BY l.id
      ORDER BY l.orderNum ASC
    `);
    res.json(lectures);
  } catch (error) {
    console.error('Lectures error:', error.message);
    res.status(500).json({ error: 'حدث خطأ في جلب المحاضرات' });
  }
});

// =======================
// مسارات التسليمات (Submissions)
// =======================
app.post('/api/submissions', authenticateToken, (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ error: 'غير مصرح - للطلاب فقط' });
  }

  try {
    const taskId = parseInt(req.body.taskId);
    const fileUrl = sanitize(req.body.fileUrl);

    if (!taskId || isNaN(taskId)) {
      return res.status(400).json({ error: 'معرف المهمة مطلوب' });
    }
    if (!fileUrl) {
      return res.status(400).json({ error: 'رابط الملف مطلوب' });
    }
    if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) {
      return res.status(400).json({ error: 'رابط الملف غير صالح' });
    }

    // التحقق من وجود المهمة
    const task = dbGet('SELECT id FROM tasks WHERE id = ?', [taskId]);
    if (!task) {
      return res.status(404).json({ error: 'المهمة غير موجودة' });
    }

    const existing = dbGet(
      'SELECT id FROM submissions WHERE userId = ? AND taskId = ?',
      [req.user.id, taskId]
    );

    if (existing) {
      dbRun('UPDATE submissions SET fileUrl = ? WHERE id = ?', [fileUrl, existing.id]);
      res.json({ message: 'تم تحديث التسليم بنجاح' });
    } else {
      dbRun(
        'INSERT INTO submissions (userId, taskId, fileUrl) VALUES (?, ?, ?)',
        [req.user.id, taskId, fileUrl]
      );
      
      // إضافة نقاط
      dbRun('UPDATE users SET points = points + 50 WHERE id = ?', [req.user.id]);
      res.status(201).json({ message: 'تم تسليم المهمة بنجاح وحصلت على 50 نقطة' });
    }
  } catch (error) {
    console.error('Submission error:', error.message);
    res.status(500).json({ error: 'حدث خطأ أثناء التسليم' });
  }
});

app.get('/api/submissions/me', authenticateToken, (req, res) => {
  try {
    const submissions = dbAll('SELECT * FROM submissions WHERE userId = ?', [req.user.id]);
    res.json(submissions);
  } catch (error) {
    console.error('My submissions error:', error.message);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// =======================
// مسارات الإدارة (Admin)
// =======================

app.get('/api/leaderboard', authenticateToken, (req, res) => {
  try {
    const students = dbAll('SELECT name, points FROM users WHERE role = ? ORDER BY points DESC LIMIT 10', ['student']);
    res.json(students);
  } catch (error) {
    console.error('Leaderboard error:', error.message);
    res.status(500).json({ error: 'حدث خطأ في جلب الليدر بورد' });
  }
});
app.get('/api/admin/submissions', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'viewer') {
    return res.status(403).json({ error: 'غير مصرح - للإدارة أو المشاهدين فقط' });
  }

  try {
    const submissions = dbAll(`
      SELECT s.*, u.name as studentName, t.title as taskTitle 
      FROM submissions s
      JOIN users u ON s.userId = u.id
      JOIN tasks t ON s.taskId = t.id
      ORDER BY s.id DESC
    `);
    res.json(submissions);
  } catch (error) {
    console.error('Admin submissions error:', error.message);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

app.get('/api/admin/students', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'viewer') {
    return res.status(403).json({ error: 'غير مصرح - للإدارة أو المشاهدين فقط' });
  }

  try {
    const students = dbAll(`
      SELECT u.id, u.name, u.username, u.points, 
             COUNT(s.id) as submissionsCount
      FROM users u 
      LEFT JOIN submissions s ON u.id = s.userId
      WHERE u.role = 'student'
      GROUP BY u.id
      ORDER BY u.name ASC
    `);

    res.json(students);
  } catch (error) {
    console.error('Admin students error:', error.message);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

app.delete('/api/admin/students/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'غير مصرح - للإدارة فقط' });
  }
  try {
    const student = dbGet('SELECT id FROM users WHERE id = ? AND role = ?', [req.params.id, 'student']);
    if (!student) return res.status(404).json({ error: 'الطالب غير موجود' });
    
    // Submissions, ratings, and attendance are cascade deleted due to FOREIGN KEY ON DELETE CASCADE
    // However, SQLite FOREIGN KEY support needs to be enabled for it to work. 
    // It is enabled in database.js, but let's be explicit just in case.
    dbRun('DELETE FROM attendance_records WHERE studentId = ?', [req.params.id]);
    dbRun('DELETE FROM submissions WHERE userId = ?', [req.params.id]);
    dbRun('DELETE FROM ratings WHERE userId = ?', [req.params.id]);
    dbRun('DELETE FROM users WHERE id = ?', [req.params.id]);
    
    res.json({ message: 'تم حذف الطالب بنجاح' });
  } catch (error) {
    console.error('Delete student error:', error.message);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

app.post('/api/admin/students', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'غير مصرح - للإدارة فقط' });
  }
  try {
    const { name, username, password, points } = req.body;
    if (!name || !username || !password) return res.status(400).json({ error: 'الاسم واسم المستخدم وكلمة المرور مطلوبة' });
    if (!isValidUsername(username)) return res.status(400).json({ error: 'اسم المستخدم يجب ألا يحتوي على مسافات' });
    if (password.length < 8) return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' });

    const cleanUsername = username.trim();
    const cleanName = sanitize(name);

    const existing = dbGet('SELECT id FROM users WHERE username = ?', [cleanUsername]);
    if (existing) return res.status(400).json({ error: 'اسم المستخدم مستخدم بالفعل' });

    const hashedPassword = bcrypt.hashSync(password, 10);
    const p = parseInt(points) || 0;

    dbRun('INSERT INTO users (name, username, password, role, points) VALUES (?, ?, ?, ?, ?)',
      [cleanName, cleanUsername, hashedPassword, 'student', p]);
    
    res.json({ message: 'تم إضافة الطالب بنجاح' });
  } catch (err) {
    console.error('Add student error:', err.message);
    res.status(500).json({ error: 'حدث خطأ أثناء إضافة الطالب' });
  }
});

app.put('/api/admin/students/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'غير مصرح - للإدارة فقط' });
  }
  try {
    const { name, username, password, points } = req.body;
    if (!name || !username) return res.status(400).json({ error: 'الاسم واسم المستخدم مطلوبان' });
    if (!isValidUsername(username)) return res.status(400).json({ error: 'اسم المستخدم يجب ألا يحتوي على مسافات' });

    const cleanUsername = username.trim();
    const cleanName = sanitize(name);

    const student = dbGet('SELECT id FROM users WHERE id = ? AND role = ?', [req.params.id, 'student']);
    if (!student) return res.status(404).json({ error: 'الطالب غير موجود' });

    const existingUsername = dbGet('SELECT id FROM users WHERE username = ? AND id != ?', [cleanUsername, req.params.id]);
    if (existingUsername) return res.status(400).json({ error: 'اسم المستخدم مستخدم من قبل مستخدم آخر' });

    const p = parseInt(points) || 0;

    if (password && password.trim().length > 0) {
      if (password.length < 8) return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' });
      const hashedPassword = bcrypt.hashSync(password, 10);
      dbRun('UPDATE users SET name = ?, username = ?, password = ?, points = ? WHERE id = ?',
        [cleanName, cleanUsername, hashedPassword, p, req.params.id]);
    } else {
      dbRun('UPDATE users SET name = ?, username = ?, points = ? WHERE id = ?',
        [cleanName, cleanUsername, p, req.params.id]);
    }
    
    res.json({ message: 'تم التعديل بنجاح' });
  } catch (err) {
    console.error('Update student error:', err.message);
    res.status(500).json({ error: 'حدث خطأ أثناء تعديل بيانات الطالب' });
  }
});

app.post('/api/admin/lectures', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'غير مصرح - للإدارة فقط' });
  }
  try {
    const { title, description, materialUrl } = req.body;
    if (!title || !materialUrl) return res.status(400).json({ error: 'العنوان ورابط الماتيريال مطلوبان' });
    
    const count = dbGet('SELECT COUNT(*) as c FROM lectures').c || 0;
    const result = dbRun('INSERT INTO lectures (title, description, materialUrl, orderNum) VALUES (?, ?, ?, ?)', 
      [sanitize(title), sanitize(description), sanitize(materialUrl), count + 1]);
    
    // Auto-create attendance session linked to this lecture
    const lectureId = result.lastInsertRowid;
    const today = new Date().toISOString().split('T')[0];
    dbRun(
      'INSERT INTO attendance_sessions (title, description, lectureId, attendanceDate, bonusPoints, latePoints, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [sanitize(title), sanitize(description || ''), lectureId, today, 10, 5, req.user.id]
    );
    
    res.json({ message: 'تمت إضافة المحاضرة وجلسة الحضور بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

app.put('/api/admin/lectures/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });
  try {
    const { title, description, materialUrl } = req.body;
    dbRun('UPDATE lectures SET title = ?, description = ?, materialUrl = ? WHERE id = ?',
      [sanitize(title), sanitize(description), sanitize(materialUrl), req.params.id]);
    res.json({ message: 'تم التعديل بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

app.delete('/api/admin/lectures/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });
  try {
    const lecture = dbGet('SELECT id FROM lectures WHERE id = ?', [req.params.id]);
    if (!lecture) return res.status(404).json({ error: 'المحاضرة غير موجودة' });
    
    dbRun('DELETE FROM ratings WHERE lectureId = ?', [req.params.id]);
    dbRun('DELETE FROM lectures WHERE id = ?', [req.params.id]);
    res.json({ message: 'تم حذف المحاضرة بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

app.post('/api/lectures/:id/rate', authenticateToken, (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'للطلاب فقط' });
  try {
    const rating = parseInt(req.body.rating);
    const comment = req.body.comment ? sanitize(req.body.comment) : null;
    const lectureId = req.params.id;
    if (rating < 1 || rating > 5) return res.status(400).json({ error: 'التقييم يجب أن يكون من 1 لـ 5' });
    
    const existing = dbGet('SELECT id FROM ratings WHERE userId = ? AND lectureId = ?', [req.user.id, lectureId]);
    if (existing) {
      dbRun('UPDATE ratings SET rating = ?, comment = ? WHERE id = ?', [rating, comment, existing.id]);
    } else {
      dbRun('INSERT INTO ratings (userId, lectureId, rating, comment) VALUES (?, ?, ?, ?)', [req.user.id, lectureId, rating, comment]);
    }
    res.json({ message: 'تم حفظ التقييم' });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

app.get('/api/lectures/:id/my-rating', authenticateToken, (req, res) => {
  try {
    const ratingData = dbGet('SELECT rating, comment FROM ratings WHERE userId = ? AND lectureId = ?', [req.user.id, req.params.id]);
    res.json({ rating: ratingData ? ratingData.rating : 0, comment: ratingData ? ratingData.comment : '' });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

app.get('/api/admin/lectures/:id/ratings', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'viewer') {
    return res.status(403).json({ error: 'غير مصرح' });
  }
  try {
    const ratings = dbAll(`
      SELECT r.rating, r.comment, r.created_at, u.name as studentName 
      FROM ratings r
      JOIN users u ON r.userId = u.id
      WHERE r.lectureId = ?
      ORDER BY r.created_at DESC
    `, [req.params.id]);
    res.json(ratings);
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ في جلب التقييمات' });
  }
});

// =======================
// مسارات التاسكات (Tasks)
// =======================
app.get('/api/tasks', authenticateToken, (req, res) => {
  try {
    const tasks = dbAll('SELECT * FROM tasks ORDER BY created_at DESC');
    res.json(tasks);
  } catch (error) {
    console.error('Tasks error:', error.message);
    res.status(500).json({ error: 'حدث خطأ في جلب المهام' });
  }
});

app.post('/api/admin/tasks', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'غير مصرح - للإدارة فقط' });
  }
  try {
    const { title, description, taskUrl } = req.body;
    if (!title || !taskUrl) return res.status(400).json({ error: 'العنوان ورابط المهمة مطلوبان' });
    
    dbRun('INSERT INTO tasks (title, description, taskUrl) VALUES (?, ?, ?)', 
      [sanitize(title), sanitize(description), sanitize(taskUrl)]);
    
    res.json({ message: 'تمت إضافة المهمة بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

app.put('/api/admin/tasks/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });
  try {
    const { title, description, taskUrl } = req.body;
    dbRun('UPDATE tasks SET title = ?, description = ?, taskUrl = ? WHERE id = ?',
      [sanitize(title), sanitize(description), sanitize(taskUrl), req.params.id]);
    res.json({ message: 'تم التعديل بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

app.delete('/api/admin/tasks/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });
  try {
    const task = dbGet('SELECT id FROM tasks WHERE id = ?', [req.params.id]);
    if (!task) return res.status(404).json({ error: 'المهمة غير موجودة' });
    
    dbRun('DELETE FROM submissions WHERE taskId = ?', [req.params.id]);
    dbRun('DELETE FROM tasks WHERE id = ?', [req.params.id]);
    res.json({ message: 'تم حذف المهمة بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// =======================
// مسارات الحضور (Attendance)
// =======================

// --- List all sessions with stats ---
app.get('/api/admin/attendance/sessions', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'viewer') {
    return res.status(403).json({ error: 'غير مصرح - للإدارة أو المشاهدين فقط' });
  }
  try {
    const sessions = dbAll(`
      SELECT s.*,
             u.name as creatorName,
             l.title as lectureTitle,
             COUNT(CASE WHEN r.status = 'present' THEN 1 END) as presentCount,
             COUNT(CASE WHEN r.status = 'absent' THEN 1 END) as absentCount,
             COUNT(CASE WHEN r.status = 'late' THEN 1 END) as lateCount,
             COUNT(r.id) as totalRecords
      FROM attendance_sessions s
      LEFT JOIN users u ON s.createdBy = u.id
      LEFT JOIN lectures l ON s.lectureId = l.id
      LEFT JOIN attendance_records r ON s.id = r.sessionId
      GROUP BY s.id
      ORDER BY s.attendanceDate DESC, s.created_at DESC
    `);
    res.json(sessions);
  } catch (error) {
    console.error('Attendance sessions error:', error.message);
    res.status(500).json({ error: 'حدث خطأ في جلب جلسات الحضور' });
  }
});

// --- Create session ---
app.post('/api/admin/attendance/sessions', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'غير مصرح - للإدارة فقط' });
  }
  try {
    const { title, description, notes, lectureId, attendanceDate, bonusPoints, latePoints } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'عنوان الجلسة مطلوب' });
    if (!attendanceDate) return res.status(400).json({ error: 'تاريخ الحضور مطلوب' });

    const bp = parseInt(bonusPoints) || 10;
    if (bp < 0 || bp > 1000) return res.status(400).json({ error: 'نقاط الحضور يجب أن تكون بين 0 و 1000' });

    // Handle latePoints: if not provided or invalid, default to 5.
    const lp = latePoints !== undefined ? parseInt(latePoints) : 5;
    if (lp < 0 || lp > 1000) return res.status(400).json({ error: 'نقاط التأخير يجب أن تكون بين 0 و 1000' });

    const lid = lectureId ? parseInt(lectureId) : null;
    if (lid) {
      const lecture = dbGet('SELECT id FROM lectures WHERE id = ?', [lid]);
      if (!lecture) return res.status(400).json({ error: 'المحاضرة المحددة غير موجودة' });
    }

    const result = dbRun(
      'INSERT INTO attendance_sessions (title, description, notes, lectureId, attendanceDate, bonusPoints, latePoints, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [sanitize(title), sanitize(description || ''), sanitize(notes || ''), lid, attendanceDate, bp, lp, req.user.id]
    );

    res.status(201).json({ message: 'تم إنشاء جلسة الحضور بنجاح', id: result.lastInsertRowid });
  } catch (error) {
    console.error('Create attendance session error:', error.message);
    res.status(500).json({ error: 'حدث خطأ أثناء إنشاء الجلسة' });
  }
});

// --- Update session ---
app.put('/api/admin/attendance/sessions/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'غير مصرح - للإدارة فقط' });
  }
  try {
    const session = dbGet('SELECT * FROM attendance_sessions WHERE id = ?', [req.params.id]);
    if (!session) return res.status(404).json({ error: 'الجلسة غير موجودة' });
    if (session.isLocked) return res.status(400).json({ error: 'الجلسة مقفلة — يرجى فتحها أولاً قبل التعديل' });

    const { title, description, notes, lectureId, attendanceDate, bonusPoints, latePoints } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'عنوان الجلسة مطلوب' });

    const bp = parseInt(bonusPoints) || 10;
    if (bp < 0 || bp > 1000) return res.status(400).json({ error: 'نقاط الحضور يجب أن تكون بين 0 و 1000' });

    const lp = latePoints !== undefined ? parseInt(latePoints) : 5;
    if (lp < 0 || lp > 1000) return res.status(400).json({ error: 'نقاط التأخير يجب أن تكون بين 0 و 1000' });

    const lid = lectureId ? parseInt(lectureId) : null;

    // If points changed, recalculate for all present/late students
    if (bp !== session.bonusPoints || lp !== session.latePoints) {
      const records = dbAll('SELECT * FROM attendance_records WHERE sessionId = ? AND status IN (?, ?)', [req.params.id, 'present', 'late']);
      for (const rec of records) {
        const targetPoints = rec.status === 'present' ? bp : lp;
        const diff = targetPoints - rec.awardedPoints;
        if (diff !== 0) {
          // Safety: prevent negative points
          if (diff < 0) {
            const student = dbGet('SELECT points FROM users WHERE id = ?', [rec.studentId]);
            if (student) {
              const newPoints = Math.max(0, student.points + diff);
              dbRun('UPDATE users SET points = ? WHERE id = ?', [newPoints, rec.studentId]);
            }
          } else {
            dbRun('UPDATE users SET points = points + ? WHERE id = ?', [diff, rec.studentId]);
          }
          dbRun('UPDATE attendance_records SET awardedPoints = ? WHERE id = ?', [targetPoints, rec.id]);
        }
      }
    }

    dbRun(
      'UPDATE attendance_sessions SET title = ?, description = ?, notes = ?, lectureId = ?, attendanceDate = ?, bonusPoints = ?, latePoints = ? WHERE id = ?',
      [sanitize(title), sanitize(description || ''), sanitize(notes || ''), lid, attendanceDate || session.attendanceDate, bp, lp, req.params.id]
    );

    res.json({ message: 'تم تعديل الجلسة بنجاح' });
  } catch (error) {
    console.error('Update attendance session error:', error.message);
    res.status(500).json({ error: 'حدث خطأ أثناء تعديل الجلسة' });
  }
});

// --- Delete session (with full points rollback) ---
app.delete('/api/admin/attendance/sessions/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'غير مصرح - للإدارة فقط' });
  }
  try {
    const session = dbGet('SELECT * FROM attendance_sessions WHERE id = ?', [req.params.id]);
    if (!session) return res.status(404).json({ error: 'الجلسة غير موجودة' });

    // Rollback all awarded points safely
    const records = dbAll('SELECT * FROM attendance_records WHERE sessionId = ? AND awardedPoints > 0', [req.params.id]);
    for (const rec of records) {
      const student = dbGet('SELECT points FROM users WHERE id = ?', [rec.studentId]);
      if (student) {
        const newPoints = Math.max(0, student.points - rec.awardedPoints);
        dbRun('UPDATE users SET points = ? WHERE id = ?', [newPoints, rec.studentId]);
      }
    }

    // CASCADE will delete attendance_records
    dbRun('DELETE FROM attendance_sessions WHERE id = ?', [req.params.id]);
    res.json({ message: 'تم حذف الجلسة واستعادة النقاط بنجاح' });
  } catch (error) {
    console.error('Delete attendance session error:', error.message);
    res.status(500).json({ error: 'حدث خطأ أثناء حذف الجلسة' });
  }
});

// --- Lock/Unlock session ---
app.put('/api/admin/attendance/sessions/:id/lock', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'غير مصرح - للإدارة فقط' });
  }
  try {
    const session = dbGet('SELECT * FROM attendance_sessions WHERE id = ?', [req.params.id]);
    if (!session) return res.status(404).json({ error: 'الجلسة غير موجودة' });

    const newLocked = session.isLocked ? 0 : 1;
    dbRun('UPDATE attendance_sessions SET isLocked = ? WHERE id = ?', [newLocked, req.params.id]);

    res.json({
      message: newLocked ? 'تم قفل الجلسة بنجاح' : 'تم فتح الجلسة بنجاح',
      isLocked: !!newLocked
    });
  } catch (error) {
    console.error('Lock attendance session error:', error.message);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// --- Get records for a session ---
app.get('/api/admin/attendance/sessions/:id/records', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'viewer') {
    return res.status(403).json({ error: 'غير مصرح' });
  }
  try {
    const session = dbGet('SELECT * FROM attendance_sessions WHERE id = ?', [req.params.id]);
    if (!session) return res.status(404).json({ error: 'الجلسة غير موجودة' });

    // Get all students with their attendance status for this session
    const students = dbAll(`
      SELECT u.id, u.name, u.username, u.points,
             ar.status, ar.awardedPoints, ar.id as recordId
      FROM users u
      LEFT JOIN attendance_records ar ON u.id = ar.studentId AND ar.sessionId = ?
      WHERE u.role = 'student'
      ORDER BY u.name ASC
    `, [req.params.id]);

    res.json({ session, students });
  } catch (error) {
    console.error('Attendance records error:', error.message);
    res.status(500).json({ error: 'حدث خطأ في جلب سجلات الحضور' });
  }
});

// --- Bulk mark attendance ---
app.post('/api/admin/attendance/sessions/:id/records', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'غير مصرح - للإدارة فقط' });
  }
  try {
    const session = dbGet('SELECT * FROM attendance_sessions WHERE id = ?', [req.params.id]);
    if (!session) return res.status(404).json({ error: 'الجلسة غير موجودة' });
    if (session.isLocked) return res.status(400).json({ error: 'الجلسة مقفلة — يرجى فتحها أولاً' });

    const { records } = req.body; // Array of { studentId, status }
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'بيانات الحضور مطلوبة' });
    }

    const validStatuses = ['present', 'absent', 'late'];
    let pointsChanged = 0;

    for (const rec of records) {
      const studentId = parseInt(rec.studentId);
      const status = rec.status;

      if (!studentId || !validStatuses.includes(status)) continue;

      // Check if student exists
      const student = dbGet('SELECT id, points FROM users WHERE id = ? AND role = ?', [studentId, 'student']);
      if (!student) continue;

      // Check existing record
      const existing = dbGet('SELECT * FROM attendance_records WHERE sessionId = ? AND studentId = ?', [req.params.id, studentId]);

      if (existing) {
        // Status changed — recalculate points
        if (existing.status !== status) {
          // Remove old points if had any
          if (existing.awardedPoints > 0) {
            const newPts = Math.max(0, student.points - existing.awardedPoints);
            dbRun('UPDATE users SET points = ? WHERE id = ?', [newPts, studentId]);
            pointsChanged -= existing.awardedPoints;
          }

          // Award new points if present or late
          const newAward = status === 'present' ? session.bonusPoints : (status === 'late' ? session.latePoints : 0);
          if (newAward > 0) {
            dbRun('UPDATE users SET points = points + ? WHERE id = ?', [newAward, studentId]);
            pointsChanged += newAward;
          }

          dbRun('UPDATE attendance_records SET status = ?, awardedPoints = ? WHERE id = ?', [status, newAward, existing.id]);
        }
      } else {
        // New record
        const award = status === 'present' ? session.bonusPoints : (status === 'late' ? session.latePoints : 0);
        dbRun(
          'INSERT INTO attendance_records (sessionId, studentId, status, awardedPoints) VALUES (?, ?, ?, ?)',
          [req.params.id, studentId, status, award]
        );
        if (award > 0) {
          dbRun('UPDATE users SET points = points + ? WHERE id = ?', [award, studentId]);
          pointsChanged += award;
        }
      }
    }

    res.json({ message: 'تم حفظ الحضور بنجاح', pointsChanged });
  } catch (error) {
    console.error('Mark attendance error:', error.message);
    res.status(500).json({ error: 'حدث خطأ أثناء حفظ الحضور' });
  }
});

// --- Attendance analytics ---
app.get('/api/admin/attendance/analytics', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'viewer') {
    return res.status(403).json({ error: 'غير مصرح' });
  }
  try {
    const totalSessions = dbGet('SELECT COUNT(*) as count FROM attendance_sessions').count;
    const totalRecords = dbGet('SELECT COUNT(*) as count FROM attendance_records').count;
    const presentCount = dbGet("SELECT COUNT(*) as count FROM attendance_records WHERE status = 'present'").count;
    const lateCount = dbGet("SELECT COUNT(*) as count FROM attendance_records WHERE status = 'late'").count;
    const absentCount = dbGet("SELECT COUNT(*) as count FROM attendance_records WHERE status = 'absent'").count;
    const totalAwarded = dbGet('SELECT COALESCE(SUM(awardedPoints), 0) as total FROM attendance_records').total;

    const attendanceRate = totalRecords > 0 ? Math.round(((presentCount + lateCount) / totalRecords) * 100) : 0;

    // Top attendees
    const topStudents = dbAll(`
      SELECT u.id, u.name,
             COUNT(CASE WHEN ar.status IN ('present', 'late') THEN 1 END) as attended,
             COUNT(ar.id) as totalSessions,
             COALESCE(SUM(ar.awardedPoints), 0) as totalPoints
      FROM users u
      JOIN attendance_records ar ON u.id = ar.studentId
      WHERE u.role = 'student'
      GROUP BY u.id
      ORDER BY attended DESC
      LIMIT 10
    `);

    // Lowest attendees
    const lowestStudents = dbAll(`
      SELECT u.id, u.name,
             COUNT(CASE WHEN ar.status IN ('present', 'late') THEN 1 END) as attended,
             COUNT(ar.id) as totalSessions
      FROM users u
      JOIN attendance_records ar ON u.id = ar.studentId
      WHERE u.role = 'student'
      GROUP BY u.id
      HAVING totalSessions > 0
      ORDER BY attended ASC
      LIMIT 10
    `);

    // Recent sessions trend (last 10 sessions)
    const trends = dbAll(`
      SELECT s.id, s.title, s.attendanceDate,
             COUNT(CASE WHEN r.status IN ('present', 'late') THEN 1 END) as present,
             COUNT(CASE WHEN r.status = 'absent' THEN 1 END) as absent,
             COUNT(r.id) as total
      FROM attendance_sessions s
      LEFT JOIN attendance_records r ON s.id = r.sessionId
      GROUP BY s.id
      ORDER BY s.attendanceDate DESC
      LIMIT 10
    `);

    res.json({
      totalSessions,
      totalRecords,
      presentCount,
      lateCount,
      absentCount,
      totalAwarded,
      attendanceRate,
      topStudents,
      lowestStudents,
      trends: trends.reverse()
    });
  } catch (error) {
    console.error('Attendance analytics error:', error.message);
    res.status(500).json({ error: 'حدث خطأ في جلب إحصائيات الحضور' });
  }
});

// --- Student: my attendance ---
app.get('/api/attendance/me', authenticateToken, (req, res) => {
  try {
    const records = dbAll(`
      SELECT ar.status, ar.awardedPoints, ar.created_at,
             s.id as sessionId, s.title, s.attendanceDate, s.bonusPoints, s.notes
      FROM attendance_records ar
      JOIN attendance_sessions s ON ar.sessionId = s.id
      WHERE ar.studentId = ?
      ORDER BY s.attendanceDate DESC
    `, [req.user.id]);

    const totalSessions = records.length;
    const attended = records.filter(r => r.status === 'present' || r.status === 'late').length;
    const totalPoints = records.reduce((sum, r) => sum + (r.awardedPoints || 0), 0);
    const attendanceRate = totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : 0;

    // Calculate streak (consecutive present/late from most recent)
    let streak = 0;
    const sorted = [...records].sort((a, b) => new Date(b.attendanceDate) - new Date(a.attendanceDate));
    for (const r of sorted) {
      if (r.status === 'present' || r.status === 'late') streak++;
      else break;
    }

    res.json({ records, totalSessions, attended, totalPoints, attendanceRate, streak });
  } catch (error) {
    console.error('Student attendance error:', error.message);
    res.status(500).json({ error: 'حدث خطأ في جلب سجل الحضور' });
  }
});

// ==============================
// نظام النسخ الاحتياطي (Backup / Restore)
// ==============================
const BACKUPS_DIR = path.join(__dirname, 'backups');
const BACKUP_SCHEMA_VERSION = '1.0.0';
const MAX_IMPORT_SIZE = 50 * 1024 * 1024; // 50MB

function ensureBackupsDir() {
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }
}

function sanitizeBackupString(val) {
  if (val === null || val === undefined) return val;
  if (typeof val !== 'string') return val;
  return val.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim();
}

function validateBackupSchema(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['ملف النسخة الاحتياطية غير صالح'] };
  }
  if (!data.meta || data.meta.platform !== 'lms-platform') {
    errors.push('الملف لا يتبع تنسيق منصة LMS');
  }
  if (!data.meta?.version) {
    errors.push('إصدار النسخة الاحتياطية مفقود');
  }
  if (!data.data || typeof data.data !== 'object') {
    errors.push('بيانات النسخة الاحتياطية مفقودة');
  }

  const requiredTables = ['users', 'lectures', 'tasks', 'submissions', 'ratings'];
  for (const table of requiredTables) {
    if (!Array.isArray(data.data?.[table])) {
      errors.push(`جدول "${table}" مفقود أو غير صالح`);
    }
  }

  // Attendance tables are optional for backward compatibility
  if (data.data?.attendance_sessions && !Array.isArray(data.data.attendance_sessions)) {
    errors.push('جدول "attendance_sessions" غير صالح');
  }
  if (data.data?.attendance_records && !Array.isArray(data.data.attendance_records)) {
    errors.push('جدول "attendance_records" غير صالح');
  }

  if (errors.length > 0) return { valid: false, errors };

  // Validate individual records
  const warnings = [];

  for (const user of data.data.users) {
    if (!user.id || !user.name || (!user.username && !user.email) || !user.password || !user.role) {
      errors.push(`مستخدم غير مكتمل البيانات (ID: ${user.id || '?'})`);
    }
    if (user.role && !['student', 'admin', 'viewer'].includes(user.role)) {
      warnings.push(`دور غير معروف "${user.role}" للمستخدم ${user.name || user.id}`);
    }
  }

  for (const lec of data.data.lectures) {
    if (!lec.id || !lec.title) {
      errors.push(`محاضرة غير مكتملة البيانات (ID: ${lec.id || '?'})`);
    }
  }

  for (const task of data.data.tasks) {
    if (!task.id || !task.title || !task.taskUrl) {
      errors.push(`مهمة غير مكتملة البيانات (ID: ${task.id || '?'})`);
    }
  }

  for (const sub of data.data.submissions) {
    if (!sub.id || !sub.userId || !sub.taskId || !sub.fileUrl) {
      errors.push(`تسليم غير مكتمل البيانات (ID: ${sub.id || '?'})`);
    }
  }

  for (const r of data.data.ratings) {
    if (!r.id || !r.userId || !r.lectureId || !r.rating) {
      errors.push(`تقييم غير مكتمل البيانات (ID: ${r.id || '?'})`);
    }
    if (r.rating && (r.rating < 1 || r.rating > 5)) {
      warnings.push(`تقييم خارج النطاق (${r.rating}) للتقييم ${r.id}`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

function buildExportPayload(scope = 'full') {
  const payload = {
    meta: {
      platform: 'lms-platform',
      version: BACKUP_SCHEMA_VERSION,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      scope,
      tables: {}
    },
    data: {}
  };

  if (scope === 'full' || scope === 'users') {
    payload.data.users = dbAll('SELECT * FROM users');
    payload.meta.tables.users = payload.data.users.length;
  }
  if (scope === 'full' || scope === 'content') {
    payload.data.lectures = dbAll('SELECT * FROM lectures');
    payload.data.tasks = dbAll('SELECT * FROM tasks');
    payload.meta.tables.lectures = payload.data.lectures.length;
    payload.meta.tables.tasks = payload.data.tasks.length;
  }
  if (scope === 'full' || scope === 'submissions') {
    payload.data.submissions = dbAll('SELECT * FROM submissions');
    payload.data.ratings = dbAll('SELECT * FROM ratings');
    payload.meta.tables.submissions = payload.data.submissions.length;
    payload.meta.tables.ratings = payload.data.ratings.length;
  }
  if (scope === 'full' || scope === 'attendance') {
    payload.data.attendance_sessions = dbAll('SELECT * FROM attendance_sessions');
    payload.data.attendance_records = dbAll('SELECT * FROM attendance_records');
    payload.meta.tables.attendance_sessions = payload.data.attendance_sessions.length;
    payload.meta.tables.attendance_records = payload.data.attendance_records.length;
  }

  // For non-full scopes, fill missing tables with empty arrays for schema compatibility
  if (scope !== 'full') {
    const allTables = ['users', 'lectures', 'tasks', 'submissions', 'ratings', 'attendance_sessions', 'attendance_records'];
    for (const t of allTables) {
      if (!payload.data[t]) payload.data[t] = [];
      if (payload.meta.tables[t] === undefined) payload.meta.tables[t] = 0;
    }
  }

  return payload;
}

// --- Export ---
app.get('/api/admin/export', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'غير مصرح - للإدارة فقط' });
  }

  try {
    const scope = ['full', 'users', 'content', 'submissions'].includes(req.query.scope)
      ? req.query.scope : 'full';

    const payload = buildExportPayload(scope);
    const json = JSON.stringify(payload, null, 2);
    const date = new Date().toISOString().slice(0, 10);
    const filename = `lms-backup-${scope}-${date}.json`;

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(json);
  } catch (error) {
    console.error('Export error:', error.message);
    res.status(500).json({ error: 'حدث خطأ أثناء تصدير البيانات' });
  }
});

// --- Validate / Dry-Run ---
app.post('/api/admin/validate-backup', authenticateToken, express.json({ limit: '50mb' }), (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'غير مصرح - للإدارة فقط' });
  }

  try {
    const backupData = req.body;
    const validation = validateBackupSchema(backupData);

    if (!validation.valid) {
      return res.json({ valid: false, errors: validation.errors, warnings: validation.warnings || [] });
    }

    // Build dry-run summary: what will change
    const currentCounts = {
      users: dbGet('SELECT COUNT(*) as c FROM users').c,
      lectures: dbGet('SELECT COUNT(*) as c FROM lectures').c,
      tasks: dbGet('SELECT COUNT(*) as c FROM tasks').c,
      submissions: dbGet('SELECT COUNT(*) as c FROM submissions').c,
      ratings: dbGet('SELECT COUNT(*) as c FROM ratings').c,
    };

    const importCounts = {
      users: backupData.data.users.length,
      lectures: backupData.data.lectures.length,
      tasks: backupData.data.tasks.length,
      submissions: backupData.data.submissions.length,
      ratings: backupData.data.ratings.length,
    };

    const conflicts = [];
    // Check for username/email conflicts in imported users
    const importedIdentifiers = backupData.data.users.map(u => u.username || u.email);
    const duplicateIdentifiers = importedIdentifiers.filter((e, i) => importedIdentifiers.indexOf(e) !== i);
    if (duplicateIdentifiers.length > 0) {
      conflicts.push(`يوجد ${duplicateIdentifiers.length} حساب مكرر في النسخة الاحتياطية`);
    }

    res.json({
      valid: true,
      meta: backupData.meta,
      currentCounts,
      importCounts,
      conflicts,
      warnings: validation.warnings || [],
    });
  } catch (error) {
    console.error('Validate error:', error.message);
    res.status(500).json({ error: 'حدث خطأ أثناء التحقق من الملف' });
  }
});

// --- Import / Restore ---
app.post('/api/admin/import', authenticateToken, express.json({ limit: '50mb' }), (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'غير مصرح - للإدارة فقط' });
  }

  try {
    const backupData = req.body;

    // Validate schema
    const validation = validateBackupSchema(backupData);
    if (!validation.valid) {
      return res.status(400).json({ error: 'ملف النسخة الاحتياطية غير صالح', details: validation.errors });
    }

    // Create automatic pre-import backup
    ensureBackupsDir();
    const preBackup = buildExportPayload('full');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilename = `pre-import-${timestamp}.json`;
    const backupPath = path.join(BACKUPS_DIR, backupFilename);
    fs.writeFileSync(backupPath, JSON.stringify(preBackup, null, 2), 'utf-8');
    console.log(`✅ Pre-import backup saved: ${backupFilename}`);

    // Perform import in a transaction with auto-rollback
    let importSuccess = false;
    try {
      // Step 1: Delete all existing data (FK-safe order)
      dbRun('DELETE FROM attendance_records');
      dbRun('DELETE FROM attendance_sessions');
      dbRun('DELETE FROM ratings');
      dbRun('DELETE FROM submissions');
      dbRun('DELETE FROM tasks');
      dbRun('DELETE FROM lectures');
      dbRun('DELETE FROM users');

      // Step 2: Insert imported data with original IDs
      const { users, lectures, tasks, submissions, ratings } = backupData.data;
      const attSessions = backupData.data.attendance_sessions || [];
      const attRecords = backupData.data.attendance_records || [];

      for (const u of users) {
        dbRun(
          'INSERT INTO users (id, name, username, password, role, points, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [u.id, sanitizeBackupString(u.name), sanitizeBackupString(u.username || u.email), u.password, u.role, u.points || 0, u.created_at || new Date().toISOString()]
        );
      }

      for (const l of lectures) {
        dbRun(
          'INSERT INTO lectures (id, title, description, materialUrl, orderNum, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          [l.id, sanitizeBackupString(l.title), sanitizeBackupString(l.description), sanitizeBackupString(l.materialUrl), l.orderNum || 0, l.created_at || new Date().toISOString()]
        );
      }

      for (const t of tasks) {
        dbRun(
          'INSERT INTO tasks (id, title, description, taskUrl, created_at) VALUES (?, ?, ?, ?, ?)',
          [t.id, sanitizeBackupString(t.title), sanitizeBackupString(t.description), sanitizeBackupString(t.taskUrl), t.created_at || new Date().toISOString()]
        );
      }

      for (const s of submissions) {
        dbRun(
          'INSERT INTO submissions (id, userId, taskId, fileUrl, grade, feedback, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [s.id, s.userId, s.taskId, sanitizeBackupString(s.fileUrl), s.grade || null, sanitizeBackupString(s.feedback), s.created_at || new Date().toISOString()]
        );
      }

      for (const r of ratings) {
        dbRun(
          'INSERT INTO ratings (id, userId, lectureId, rating, comment, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          [r.id, r.userId, r.lectureId, r.rating, sanitizeBackupString(r.comment), r.created_at || new Date().toISOString()]
        );
      }

      for (const as of attSessions) {
        dbRun(
          'INSERT INTO attendance_sessions (id, title, description, notes, lectureId, attendanceDate, bonusPoints, isLocked, createdBy, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [as.id, sanitizeBackupString(as.title), sanitizeBackupString(as.description), sanitizeBackupString(as.notes), as.lectureId, as.attendanceDate, as.bonusPoints || 10, as.isLocked || 0, as.createdBy, as.created_at || new Date().toISOString()]
        );
      }

      for (const ar of attRecords) {
        dbRun(
          'INSERT INTO attendance_records (id, sessionId, studentId, status, awardedPoints, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          [ar.id, ar.sessionId, ar.studentId, ar.status, ar.awardedPoints || 0, ar.created_at || new Date().toISOString()]
        );
      }

      importSuccess = true;
    } catch (importError) {
      console.error('Import failed, attempting auto-rollback:', importError.message);

      // Auto-rollback: restore from the pre-import backup
      try {
        dbRun('DELETE FROM attendance_records');
        dbRun('DELETE FROM attendance_sessions');
        dbRun('DELETE FROM ratings');
        dbRun('DELETE FROM submissions');
        dbRun('DELETE FROM tasks');
        dbRun('DELETE FROM lectures');
        dbRun('DELETE FROM users');

        const rollbackData = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
        const { users, lectures, tasks, submissions, ratings } = rollbackData.data;
        const rbAttSessions = rollbackData.data.attendance_sessions || [];
        const rbAttRecords = rollbackData.data.attendance_records || [];

        for (const u of users) {
          dbRun('INSERT INTO users (id, name, username, password, role, points, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [u.id, u.name, u.username || u.email, u.password, u.role, u.points || 0, u.created_at]);
        }
        for (const l of lectures) {
          dbRun('INSERT INTO lectures (id, title, description, materialUrl, orderNum, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [l.id, l.title, l.description, l.materialUrl, l.orderNum || 0, l.created_at]);
        }
        for (const t of tasks) {
          dbRun('INSERT INTO tasks (id, title, description, taskUrl, created_at) VALUES (?, ?, ?, ?, ?)',
            [t.id, t.title, t.description, t.taskUrl, t.created_at]);
        }
        for (const s of submissions) {
          dbRun('INSERT INTO submissions (id, userId, taskId, fileUrl, grade, feedback, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [s.id, s.userId, s.taskId, s.fileUrl, s.grade || null, s.feedback, s.created_at]);
        }
        for (const r of ratings) {
          dbRun('INSERT INTO ratings (id, userId, lectureId, rating, comment, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [r.id, r.userId, r.lectureId, r.rating, r.comment, r.created_at]);
        }
        for (const as of rbAttSessions) {
          dbRun('INSERT INTO attendance_sessions (id, title, description, notes, lectureId, attendanceDate, bonusPoints, isLocked, createdBy, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [as.id, as.title, as.description, as.notes, as.lectureId, as.attendanceDate, as.bonusPoints || 10, as.isLocked || 0, as.createdBy, as.created_at]);
        }
        for (const ar of rbAttRecords) {
          dbRun('INSERT INTO attendance_records (id, sessionId, studentId, status, awardedPoints, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [ar.id, ar.sessionId, ar.studentId, ar.status, ar.awardedPoints || 0, ar.created_at]);
        }

        console.log('✅ Auto-rollback successful — data restored to pre-import state');
        return res.status(500).json({
          error: 'فشل الاستيراد — تم استعادة البيانات السابقة تلقائياً',
          rollback: true,
          details: importError.message,
        });
      } catch (rollbackError) {
        console.error('CRITICAL: Rollback also failed:', rollbackError.message);
        return res.status(500).json({
          error: 'فشل الاستيراد وفشلت الاستعادة التلقائية — يرجى استعادة النسخة الاحتياطية يدوياً',
          rollback: false,
          backupFile: backupFilename,
        });
      }
    }

    if (importSuccess) {
      const summary = {
        users: backupData.data.users.length,
        lectures: backupData.data.lectures.length,
        tasks: backupData.data.tasks.length,
        submissions: backupData.data.submissions.length,
        ratings: backupData.data.ratings.length,
        attendance_sessions: (backupData.data.attendance_sessions || []).length,
        attendance_records: (backupData.data.attendance_records || []).length,
      };
      console.log('✅ Import completed successfully:', summary);
      res.json({
        message: 'تم استيراد البيانات بنجاح',
        summary,
        backupFile: backupFilename,
      });
    }
  } catch (error) {
    console.error('Import error:', error.message);
    res.status(500).json({ error: 'حدث خطأ أثناء استيراد البيانات' });
  }
});

// --- Backup History ---
app.get('/api/admin/backups', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'غير مصرح - للإدارة فقط' });
  }

  try {
    ensureBackupsDir();
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(filename => {
        const filePath = path.join(BACKUPS_DIR, filename);
        const stats = fs.statSync(filePath);
        return {
          filename,
          size: stats.size,
          createdAt: stats.mtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(files);
  } catch (error) {
    console.error('Backup list error:', error.message);
    res.status(500).json({ error: 'حدث خطأ في جلب قائمة النسخ الاحتياطية' });
  }
});

// --- Download Backup ---
app.get('/api/admin/backups/:filename', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'غير مصرح - للإدارة فقط' });
  }

  try {
    const filename = path.basename(req.params.filename); // Prevent path traversal
    if (!filename.endsWith('.json')) {
      return res.status(400).json({ error: 'نوع الملف غير مدعوم' });
    }

    const filePath = path.join(BACKUPS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'النسخة الاحتياطية غير موجودة' });
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.sendFile(filePath);
  } catch (error) {
    console.error('Backup download error:', error.message);
    res.status(500).json({ error: 'حدث خطأ أثناء تحميل النسخة الاحتياطية' });
  }
});

// --- Delete Backup ---
app.delete('/api/admin/backups/:filename', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'غير مصرح - للإدارة فقط' });
  }

  try {
    const filename = path.basename(req.params.filename); // Prevent path traversal
    if (!filename.endsWith('.json')) {
      return res.status(400).json({ error: 'نوع الملف غير مدعوم' });
    }

    const filePath = path.join(BACKUPS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'النسخة الاحتياطية غير موجودة' });
    }

    fs.unlinkSync(filePath);
    res.json({ message: 'تم حذف النسخة الاحتياطية بنجاح' });
  } catch (error) {
    console.error('Backup delete error:', error.message);
    res.status(500).json({ error: 'حدث خطأ أثناء حذف النسخة الاحتياطية' });
  }
});

// ==============================
// SPA Fallback Route
// ==============================
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    res.status(404).json({ error: 'Endpoint not found' });
  } else {
    // Smart fallback: try to serve the base path HTML file to avoid hydration mismatch
    const baseSegment = req.path.split('/')[1];
    const possibleFile = path.join(__dirname, 'client', 'out', `${baseSegment}.html`);
    
    if (baseSegment && fs.existsSync(possibleFile)) {
      res.sendFile(possibleFile);
    } else {
      res.sendFile(path.join(__dirname, 'client', 'out', 'index.html'));
    }
  }
});

// ==============================
// Error Handling Middleware
// ==============================
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'حدث خطأ غير متوقع في الخادم' });
});

// ==============================
// Start Server
// ==============================
async function startServer() {
  try {
    // اتصال قاعدة البيانات أولاً
    await setupDB();
    console.log('✅ Database connected successfully!');

    // ثم بدء السيرفر
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running perfectly!`);
      console.log(`🌍 Main Website: http://localhost:${PORT}`);
      console.log(`📡 Health check: http://localhost:${PORT}/health`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
}

startServer();
