const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const { setupDB, dbGet, dbAll, dbRun } = require('./database');

// ==============================
// إعداد التطبيق
// ==============================
const app = express();
const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.SECRET_KEY || 'lms_super_secret_key_123';
if (!process.env.SECRET_KEY && process.env.NODE_ENV === 'production') {
  console.error('FATAL ERROR: SECRET_KEY is not defined.');
  process.exit(1);
}

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
    const user = jwt.verify(token, SECRET_KEY);
    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'انتهت صلاحية الجلسة - يرجى إعادة تسجيل الدخول' });
  }
}

// ==============================
// Input Validation Helpers
// ==============================
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, 500);
}

// =======================
// مسارات المصادقة (Auth)
// =======================
app.post('/api/register', (req, res) => {
  try {
    const name = sanitize(req.body.name);
    const email = sanitize(req.body.email);
    const password = req.body.password;
    const role = 'student'; // Security Fix: Force student role

    // Validation
    if (!name || name.length < 2) {
      return res.status(400).json({ error: 'الاسم مطلوب (حرفين على الأقل)' });
    }
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'بريد إلكتروني غير صالح' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'كلمة المرور مطلوبة (8 أحرف على الأقل)' });
    }

    // Check existing
    const existing = dbGet('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(400).json({ error: 'البريد الإلكتروني مسجل مسبقاً' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = dbRun(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, role]
    );

    const newUser = { id: result.lastInsertRowid, name, email, role };
    const token = jwt.sign({ id: newUser.id, name, email, role }, SECRET_KEY, { expiresIn: '24h' });

    res.status(201).json({ user: { ...newUser, points: 0 }, token });
  } catch (error) {
    console.error('Register error:', error.message);
    res.status(500).json({ error: 'حدث خطأ في الخادم' });
  }
});

app.post('/api/login', (req, res) => {
  try {
    const email = sanitize(req.body.email);
    const password = req.body.password;

    if (!email || !password) {
      return res.status(400).json({ error: 'البريد وكلمة المرور مطلوبان' });
    }

    const user = dbGet('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(400).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    const tokenPayload = { id: user.id, name: user.name, email: user.email, role: user.role };
    const token = jwt.sign(tokenPayload, SECRET_KEY, { expiresIn: '24h' });

    res.json({ user: { ...tokenPayload, points: user.points }, token });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ error: 'حدث خطأ في الخادم' });
  }
});

app.get('/api/me', authenticateToken, (req, res) => {
  try {
    const user = dbGet('SELECT id, name, email, role, points, created_at FROM users WHERE id = ?', [req.user.id]);
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
    const lectureId = parseInt(req.body.lectureId);
    const fileUrl = sanitize(req.body.fileUrl);

    if (!lectureId || isNaN(lectureId)) {
      return res.status(400).json({ error: 'معرف المحاضرة مطلوب' });
    }
    if (!fileUrl) {
      return res.status(400).json({ error: 'رابط الملف مطلوب' });
    }
    if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) {
      return res.status(400).json({ error: 'رابط الملف غير صالح' });
    }

    // التحقق من وجود المحاضرة
    const lecture = dbGet('SELECT id FROM lectures WHERE id = ?', [lectureId]);
    if (!lecture) {
      return res.status(404).json({ error: 'المحاضرة غير موجودة' });
    }

    const existing = dbGet(
      'SELECT id FROM submissions WHERE userId = ? AND lectureId = ?',
      [req.user.id, lectureId]
    );

    if (existing) {
      dbRun('UPDATE submissions SET fileUrl = ? WHERE id = ?', [fileUrl, existing.id]);
      res.json({ message: 'تم تحديث التسليم بنجاح' });
    } else {
      dbRun(
        'INSERT INTO submissions (userId, lectureId, fileUrl) VALUES (?, ?, ?)',
        [req.user.id, lectureId, fileUrl]
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
      SELECT s.*, u.name as studentName, l.title as lectureTitle 
      FROM submissions s
      JOIN users u ON s.userId = u.id
      JOIN lectures l ON s.lectureId = l.id
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
      SELECT u.id, u.name, u.email, u.points, 
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
    
    // Submissions and ratings are cascade deleted due to FOREIGN KEY ON DELETE CASCADE
    // However, SQLite FOREIGN KEY support needs to be enabled for it to work. 
    // It is enabled in database.js, but let's be explicit just in case.
    dbRun('DELETE FROM submissions WHERE userId = ?', [req.params.id]);
    dbRun('DELETE FROM ratings WHERE userId = ?', [req.params.id]);
    dbRun('DELETE FROM users WHERE id = ?', [req.params.id]);
    
    res.json({ message: 'تم حذف الطالب بنجاح' });
  } catch (error) {
    console.error('Delete student error:', error.message);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

app.post('/api/admin/lectures', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'غير مصرح - للإدارة فقط' });
  }
  try {
    const { title, description, videoUrl } = req.body;
    if (!title || !videoUrl) return res.status(400).json({ error: 'العنوان ورابط الفيديو مطلوبان' });
    
    const count = dbGet('SELECT COUNT(*) as c FROM lectures').c || 0;
    dbRun('INSERT INTO lectures (title, description, videoUrl, orderNum) VALUES (?, ?, ?, ?)', 
      [sanitize(title), sanitize(description), sanitize(videoUrl), count + 1]);
    
    res.json({ message: 'تمت إضافة المحاضرة بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

app.put('/api/admin/lectures/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });
  try {
    const { title, description, videoUrl } = req.body;
    dbRun('UPDATE lectures SET title = ?, description = ?, videoUrl = ? WHERE id = ?',
      [sanitize(title), sanitize(description), sanitize(videoUrl), req.params.id]);
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
    
    dbRun('DELETE FROM submissions WHERE lectureId = ?', [req.params.id]);
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
    const lectureId = req.params.id;
    if (rating < 1 || rating > 5) return res.status(400).json({ error: 'التقييم يجب أن يكون من 1 لـ 5' });
    
    const existing = dbGet('SELECT id FROM ratings WHERE userId = ? AND lectureId = ?', [req.user.id, lectureId]);
    if (existing) {
      dbRun('UPDATE ratings SET rating = ? WHERE id = ?', [rating, existing.id]);
    } else {
      dbRun('INSERT INTO ratings (userId, lectureId, rating) VALUES (?, ?, ?)', [req.user.id, lectureId, rating]);
    }
    res.json({ message: 'تم حفظ التقييم' });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

app.get('/api/lectures/:id/my-rating', authenticateToken, (req, res) => {
  try {
    const rating = dbGet('SELECT rating FROM ratings WHERE userId = ? AND lectureId = ?', [req.user.id, req.params.id]);
    res.json({ rating: rating ? rating.rating : 0 });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// ==============================
// 404 Route
// ==============================
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    res.status(404).json({ error: 'Endpoint not found' });
  } else {
    res.status(404).sendFile(path.join(__dirname, 'client', 'out', '404.html'), (err) => {
      if (err) res.status(404).send('Not Found');
    });
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
