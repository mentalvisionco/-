const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const setupDB = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET_KEY = 'lms_super_secret_key_123'; // In production, use process.env.SECRET_KEY

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve frontend files

let db;

// Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'غير مصرح لك' });
  
  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: 'انتهت صلاحية الجلسة' });
    req.user = user;
    next();
  });
};

// Start Server IMMEDIATELY for Railway health check
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  
  // Connect DB after server starts
  setupDB().then(database => {
    db = database;
    console.log("Database connected successfully!");
  }).catch(err => {
    console.error("Database connection failed", err);
    process.exit(1);
  });
});

// =======================
// مسارات المصادقة (Auth Routes)
// =======================
app.post('/api/register', async (req, res) => {
  const { name, email, password, role } = req.body;
  try {
    const existing = await db.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) return res.status(400).json({ error: 'البريد الإلكتروني مسجل مسبقاً' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.run(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, role || 'student']
    );

    const newUser = { id: result.lastID, name, email, role: role || 'student', points: 0 };
    const token = jwt.sign(newUser, SECRET_KEY, { expiresIn: '24h' });

    res.status(201).json({ user: newUser, token });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في الخادم' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) return res.status(400).json({ error: 'بيانات الدخول غير صحيحة' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'بيانات الدخول غير صحيحة' });

    const userPayload = { id: user.id, name: user.name, email: user.email, role: user.role, points: user.points };
    const token = jwt.sign(userPayload, SECRET_KEY, { expiresIn: '24h' });

    res.json({ user: userPayload, token });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في الخادم' });
  }
});

app.get('/api/me', authenticateToken, async (req, res) => {
  try {
    const user = await db.get('SELECT id, name, email, role, points FROM users WHERE id = ?', [req.user.id]);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في الخادم' });
  }
});

// =======================
// مسارات المحاضرات (Lectures Routes)
// =======================
app.get('/api/lectures', authenticateToken, async (req, res) => {
  try {
    const lectures = await db.all('SELECT * FROM lectures ORDER BY orderNum ASC');
    res.json(lectures);
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في جلب المحاضرات' });
  }
});

// =======================
// مسارات التسليمات (Submissions & Tasks)
// =======================
app.post('/api/submissions', authenticateToken, async (req, res) => {
  const { lectureId, fileUrl } = req.body;
  if (req.user.role !== 'student') return res.status(403).json({ error: 'غير مصرح' });

  try {
    const existing = await db.get('SELECT id FROM submissions WHERE userId = ? AND lectureId = ?', [req.user.id, lectureId]);
    if (existing) {
      await db.run('UPDATE submissions SET fileUrl = ? WHERE id = ?', [fileUrl, existing.id]);
      res.json({ message: 'تم تحديث التسليم بنجاح' });
    } else {
      await db.run('INSERT INTO submissions (userId, lectureId, fileUrl) VALUES (?, ?, ?)', [req.user.id, lectureId, fileUrl]);
      // Add points to user
      await db.run('UPDATE users SET points = points + 50 WHERE id = ?', [req.user.id]);
      res.status(201).json({ message: 'تم تسليم المهمة بنجاح وحصلت على 50 نقطة' });
    }
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ أثناء التسليم' });
  }
});

app.get('/api/submissions/me', authenticateToken, async (req, res) => {
  try {
    const submissions = await db.all('SELECT * FROM submissions WHERE userId = ?', [req.user.id]);
    res.json(submissions);
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Admin ONLY: Get All Submissions
app.get('/api/admin/submissions', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });
  try {
    const submissions = await db.all(`
      SELECT s.*, u.name as studentName, l.title as lectureTitle 
      FROM submissions s
      JOIN users u ON s.userId = u.id
      JOIN lectures l ON s.lectureId = l.id
      ORDER BY s.id DESC
    `);
    res.json(submissions);
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Admin ONLY: Get All Students and their stats
app.get('/api/admin/students', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });
  try {
    const students = await db.all('SELECT id, name, email, points FROM users WHERE role = "student"');
    for (let student of students) {
      const subs = await db.get('SELECT COUNT(*) as count FROM submissions WHERE userId = ?', [student.id]);
      student.submissionsCount = subs.count;
    }
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});
