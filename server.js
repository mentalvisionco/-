const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const logger = require('./services/logger');

// Load .env file manually if it exists to support local development environments without external dotenv package
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const parts = trimmed.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      if (key && process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
  });
}

// Startup Environment Validation
function validateEnv() {
  const missing = [];
  if (process.env.NODE_ENV === 'production' && !process.env.SECRET_KEY) {
    missing.push('SECRET_KEY');
  }
  if (!process.env.GOOGLE_DRIVE_FOLDER_ID) {
    missing.push('GOOGLE_DRIVE_FOLDER_ID');
  }
  
  // Validate Google Drive OAuth2 parameters
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.GOOGLE_CLIENT_ID) {
      missing.push('GOOGLE_CLIENT_ID');
    }
    if (!process.env.GOOGLE_CLIENT_SECRET) {
      missing.push('GOOGLE_CLIENT_SECRET');
    }
    if (!process.env.GOOGLE_REFRESH_TOKEN) {
      missing.push('GOOGLE_REFRESH_TOKEN');
    }
  } else {
    // In development, warn if OAuth2 credentials are missing but do not crash
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
      logger.warn('⚠️ Warning: Google Drive OAuth2 environment configuration is incomplete (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN). File uploads will fail.');
    }
  }
  
  if (missing.length > 0) {
    logger.error('❌ FATAL STARTUP ERROR: Missing required environment configuration:');
    missing.forEach(m => logger.error(`   - ${m}`));
    process.exit(1);
  }
}
validateEnv();

const { setupDB, dbGet, dbAll, dbRun, logAudit, dbBackup } = require('./database');
const multer = require('multer');
const { uploadFile, deleteFile } = require('./services/storage');

// ==============================
// Multer Configuration
// ==============================
const storage = multer.memoryStorage();

const ALLOWED_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg', '.zip',
  '.psd', '.psb', '.ai', '.eps'
];
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/zip',
  'application/x-zip-compressed',
  // Photoshop MIME types
  'image/vnd.adobe.photoshop',
  'image/psd',
  'application/x-photoshop',
  'application/photoshop',
  'application/psd',
  // Illustrator/EPS MIME types
  'application/vnd.adobe.illustrator',
  'application/postscript',
  'image/x-eps',
  'application/eps',
  'application/x-eps'
];
const REJECTED_EXTENSIONS = ['.exe', '.bat', '.sh', '.js'];
const REJECTED_MIME_TYPES = [
  'application/x-msdownload',
  'application/x-sh',
  'application/x-bash',
  'application/javascript',
  'text/javascript'
];

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype.toLowerCase();

    // Check if extension or mimeType is rejected
    if (REJECTED_EXTENSIONS.includes(ext) || REJECTED_MIME_TYPES.includes(mimeType)) {
      return cb(new Error('الملفات من هذا النوع غير مسموح بها (exe, bat, sh, js)'));
    }

    // Check if extension and mimeType are allowed
    const isExtAllowed = ALLOWED_EXTENSIONS.includes(ext);
    const isMimeAllowed = ALLOWED_MIME_TYPES.includes(mimeType);

    if (!isExtAllowed || !isMimeAllowed) {
      return cb(new Error('نوع الملف غير مدعوم. الأنواع المسموح بها هي: pdf, doc, docx, png, jpg, jpeg, zip, psd, psb, ai, eps'));
    }

    cb(null, true);
  }
});

const uploadSingle = upload.single('file');

// ==============================
// إعداد التطبيق
// ==============================
const app = express();
const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.SECRET_KEY;
let ACTIVE_SECRET_KEY = SECRET_KEY;
if (!SECRET_KEY) {
  if (process.env.NODE_ENV === 'production') {
    logger.error('FATAL ERROR: SECRET_KEY is not defined in production environment.');
    process.exit(1);
  } else {
    // Generate a secure random string dynamically in development to prevent insecure static defaults
    const fallbackSecret = crypto.randomBytes(32).toString('hex');
    logger.warn('WARNING: SECRET_KEY is not defined in .env. Generated a secure, dynamic fallback key for development.');
    ACTIVE_SECRET_KEY = fallbackSecret;
  }
}

// Security Middlewares & CORS
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://*", "blob:"],
      mediaSrc: ["'self'", "https://*", "blob:"],
      connectSrc: ["'self'", "https://*", "http://localhost:*"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || (process.env.NODE_ENV !== 'production' && origin.startsWith('http://localhost:'))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'client', 'out'), { extensions: ['html'] }));

// ==============================
// Rate Limiting
// ==============================
app.set('trust proxy', 1);

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: { error: 'طلبات كثيرة جداً، حاول بعد قليل' }
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // limit each IP to 15 upload requests per windowMs
  message: { error: 'لقد تجاوزت حد الرفع المسموح به. يرجى المحاولة بعد 15 دقيقة.' }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit login attempts to 5 per 15 minutes
  message: { error: 'محاولات دخول كثيرة جداً، يرجى المحاولة بعد 15 دقيقة' }
});

app.use('/api', apiLimiter);
app.use('/api/login', loginLimiter);

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
    // Return 401 to trigger token refresh queue on the client
    return res.status(401).json({ error: 'انتهت صلاحية الجلسة - يرجى إعادة تسجيل الدخول' });
  }
}

// Authorization Middlewares
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'غير مصرح لك - لا تملك الصلاحيات الكافية' });
    }
    next();
  };
}

const requireAdmin = requireRole('admin');
const requireStudent = requireRole('student');
const requireViewerOrAdmin = requireRole('admin', 'viewer');

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

function generateRefreshToken() {
  return crypto.randomBytes(40).toString('hex');
}

app.post('/api/login', (req, res) => {
  try {
    const username = sanitize(req.body.username);
    const password = req.body.password;

    if (!username || !password) {
      logAudit(null, 'login_failed', { error: 'Username or password missing' }, req);
      return res.status(400).json({ error: 'اسم المستخدم وكلمة المرور مطلوبان' });
    }

    const user = dbGet('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      logAudit(null, 'login_failed', { username, error: 'User not found' }, req);
      return res.status(400).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      logAudit(null, 'login_failed', { username, error: 'Invalid password' }, req);
      return res.status(400).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    const tokenPayload = { id: user.id, name: user.name, username: user.username, role: user.role };
    // Access token valid for 15 minutes
    const accessToken = jwt.sign(tokenPayload, ACTIVE_SECRET_KEY, { expiresIn: '15m' });
    
    // Refresh token valid for 7 days
    const refreshToken = generateRefreshToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const userAgent = req.headers['user-agent'] || null;
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;

    dbRun(
      'INSERT INTO sessions (token, userId, userAgent, ipAddress, expiresAt) VALUES (?, ?, ?, ?, ?)',
      [refreshToken, user.id, userAgent, ipAddress, expiresAt]
    );

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    logAudit(user.id, 'login_success', { username: user.username }, req);

    res.json({ user: { ...tokenPayload, points: user.points }, token: accessToken });
  } catch (error) {
    logger.error('Login error: %s', error.stack);
    res.status(500).json({ error: 'حدث خطأ في الخادم' });
  }
});

app.post('/api/auth/refresh', (req, res) => {
  // CSRF Guard: Custom header check
  const csrfHeader = req.headers['x-requested-with'];
  if (csrfHeader !== 'XMLHttpRequest') {
    logger.warn('CSRF Guard: Missing custom header on token refresh request.');
    return res.status(400).json({ error: 'طلب غير صالح (CSRF Guard)' });
  }

  // CSRF Guard: Origin check
  const origin = req.headers['origin'] || req.headers['referer'];
  if (origin) {
    try {
      const originUrl = new URL(origin, 'http://localhost');
      const isAllowed = allowedOrigins.includes(originUrl.origin) || 
                        (process.env.NODE_ENV !== 'production' && originUrl.origin.includes('localhost'));
      if (!isAllowed && originUrl.origin !== `${req.protocol}://${req.get('host')}`) {
        logger.warn(`CSRF Guard: Blocked origin ${originUrl.origin} on token refresh request.`);
        return res.status(400).json({ error: 'طلب غير صالح (CORS/CSRF)' });
      }
    } catch (e) {
      return res.status(400).json({ error: 'طلب غير صالح (CORS/CSRF parsing)' });
    }
  }

  const oldRefreshToken = req.cookies.refreshToken;
  if (!oldRefreshToken) {
    return res.status(401).json({ error: 'انتهت صلاحية الجلسة' });
  }

  try {
    const session = dbGet('SELECT * FROM sessions WHERE token = ?', [oldRefreshToken]);
    if (!session) {
      logger.warn('Replay attack warning or session already revoked.');
      res.clearCookie('refreshToken');
      return res.status(401).json({ error: 'جلسة غير صالحة' });
    }

    if (new Date(session.expiresAt) < new Date()) {
      dbRun('DELETE FROM sessions WHERE token = ?', [oldRefreshToken]);
      res.clearCookie('refreshToken');
      return res.status(401).json({ error: 'انتهت صلاحية الجلسة' });
    }

    const user = dbGet('SELECT * FROM users WHERE id = ?', [session.userId]);
    if (!user) {
      dbRun('DELETE FROM sessions WHERE token = ?', [oldRefreshToken]);
      res.clearCookie('refreshToken');
      return res.status(401).json({ error: 'مستخدم غير موجود' });
    }

    const tokenPayload = { id: user.id, name: user.name, username: user.username, role: user.role };
    const newAccessToken = jwt.sign(tokenPayload, ACTIVE_SECRET_KEY, { expiresIn: '15m' });

    // Refresh Token Rotation (RTR)
    const newRefreshToken = generateRefreshToken();
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    dbRun('DELETE FROM sessions WHERE token = ?', [oldRefreshToken]);

    const userAgent = req.headers['user-agent'] || null;
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;
    dbRun(
      'INSERT INTO sessions (token, userId, userAgent, ipAddress, expiresAt) VALUES (?, ?, ?, ?, ?)',
      [newRefreshToken, user.id, userAgent, ipAddress, newExpiresAt]
    );

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ accessToken: newAccessToken });
  } catch (error) {
    logger.error('Token refresh error: %s', error.stack);
    res.status(500).json({ error: 'حدث خطأ في الخادم' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  const oldRefreshToken = req.cookies.refreshToken;
  if (oldRefreshToken) {
    try {
      const session = dbGet('SELECT userId FROM sessions WHERE token = ?', [oldRefreshToken]);
      if (session) {
        logAudit(session.userId, 'logout', null, req);
      }
      dbRun('DELETE FROM sessions WHERE token = ?', [oldRefreshToken]);
    } catch (err) {
      logger.error('Logout error: %s', err.stack);
    }
  }
  res.clearCookie('refreshToken');
  res.json({ message: 'تم تسجيل الخروج بنجاح' });
});

app.get('/api/me', authenticateToken, (req, res) => {
  try {
    const user = dbGet('SELECT id, name, username, role, points, fill_card_count, created_at FROM users WHERE id = ?', [req.user.id]);
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
      logAudit(req.user.id, 'password_change_failed', { error: 'Invalid current password' }, req);
      return res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة' });
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    dbRun('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.user.id]);
    
    logAudit(req.user.id, 'password_change_success', null, req);
    res.json({ message: 'تم تغيير كلمة المرور بنجاح' });
  } catch (error) {
    logger.error('Password change error: %s', error.stack);
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
    logger.error('Lectures error: %s', error.stack);
    res.status(500).json({ error: 'حدث خطأ في جلب المحاضرات' });
  }
});

// =======================
// مسارات التسليمات (Submissions)
// =======================
app.post('/api/submissions', authenticateToken, requireStudent, uploadLimiter, (req, res) => {
  uploadSingle(req, res, async function (err) {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'حجم الملف كبير جداً. الحد الأقصى هو 500 ميجابايت' });
        }
        return res.status(400).json({ error: `خطأ في تحميل الملف: ${err.message}` });
      }
      return res.status(400).json({ error: err.message });
    }

    try {
      const taskId = parseInt(req.body.taskId);
      let fileUrl = sanitize(req.body.fileUrl);

      if (!taskId || isNaN(taskId)) {
        return res.status(400).json({ error: 'معرف المهمة مطلوب' });
      }

      // Check validation: at least one submission method is required
      const hasUrl = !!fileUrl;
      const hasFile = !!req.file;

      if (!hasUrl && !hasFile) {
        return res.status(400).json({ error: 'يجب إدخال رابط أو تحميل ملف لتسليم المهمة.' });
      }

      if (hasUrl && !fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) {
        return res.status(400).json({ error: 'رابط الملف غير صالح' });
      }

      // التحقق من وجود المهمة
      const task = dbGet('SELECT id, title FROM tasks WHERE id = ?', [taskId]);
      if (!task) {
        return res.status(404).json({ error: 'المهمة غير موجودة' });
      }

      // If they uploaded a file, we process it and upload to Google Drive
      let fileId = null;
      let driveUrl = null;
      let originalName = null;

      if (hasFile) {
        try {
          // Upload file to Google Drive using services/storage
          const uploadResult = await uploadFile(req.file);
          fileId = uploadResult.id;
          driveUrl = uploadResult.webViewLink;
          originalName = req.file.originalname;
          // Set fileUrl to the drive URL so it can be stored in the legacy field if needed
          if (!fileUrl) {
            fileUrl = driveUrl;
          }
        } catch (uploadError) {
          logger.error('Google Drive Upload error: %s', uploadError.stack);
          return res.status(500).json({ error: 'حدث خطأ أثناء رفع الملف إلى Google Drive' });
        }
      }

      const existing = dbGet(
        'SELECT id, uploadedFileId FROM submissions WHERE userId = ? AND taskId = ?',
        [req.user.id, taskId]
      );

      if (existing) {
        // If there was an old file in Drive, delete it
        if (existing.uploadedFileId && hasFile) {
          try {
            await deleteFile(existing.uploadedFileId);
          } catch (deleteError) {
            logger.warn('Failed to delete old file from Drive: %s', deleteError.message);
          }
        }

        dbRun(
          'UPDATE submissions SET fileUrl = ?, uploadedFileId = ?, uploadedFileUrl = ?, uploadedFileName = ?, storageProvider = ? WHERE id = ?', 
          [fileUrl, fileId || (hasFile ? null : existing.uploadedFileId), driveUrl || null, originalName || null, hasFile ? 'google-drive' : null, existing.id]
        );
        
        logAudit(req.user.id, 'submission_update', { taskId, taskTitle: task.title, fileUrl }, req);
        res.json({ message: 'تم تحديث التسليم بنجاح' });
      } else {
        dbRun(
          'INSERT INTO submissions (userId, taskId, fileUrl, uploadedFileId, uploadedFileUrl, uploadedFileName, storageProvider) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [req.user.id, taskId, fileUrl, fileId, driveUrl, originalName, hasFile ? 'google-drive' : null]
        );
        
        logAudit(req.user.id, 'submission_create', { taskId, taskTitle: task.title, fileUrl }, req);
        res.status(201).json({ message: 'تم تسليم المهمة بنجاح، في انتظار تقييم المعلم' });
      }
    } catch (error) {
      logger.error('Submission error: %s', error.stack);
      res.status(500).json({ error: 'حدث خطأ أثناء التسليم' });
    }
  });
});

app.get('/api/submissions/me', authenticateToken, (req, res) => {
  try {
    const submissions = dbAll('SELECT * FROM submissions WHERE userId = ?', [req.user.id]);
    res.json(submissions);
  } catch (error) {
    logger.error('My submissions error: %s', error.stack);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

app.delete('/api/submissions/:taskId', authenticateToken, requireStudent, async (req, res) => {
  try {
    const taskId = parseInt(req.params.taskId);
    if (!taskId || isNaN(taskId)) {
      return res.status(400).json({ error: 'معرف المهمة مطلوب' });
    }

    const task = dbGet('SELECT title FROM tasks WHERE id = ?', [taskId]);
    const existing = dbGet(
      'SELECT id, grade, uploadedFileId FROM submissions WHERE userId = ? AND taskId = ?',
      [req.user.id, taskId]
    );

    if (!existing) {
      return res.status(404).json({ error: 'لم يتم العثور على تسليم لهذه المهمة' });
    }

    // Clean up file from Google Drive if exists
    if (existing.uploadedFileId) {
      try {
        await deleteFile(existing.uploadedFileId);
      } catch (deleteError) {
        logger.warn('Failed to delete file from Drive on submission delete: %s', deleteError.message);
      }
    }

    if (existing.grade && existing.grade > 0) {
      const student = dbGet('SELECT points FROM users WHERE id = ?', [req.user.id]);
      if (student) {
        let newPoints = student.points - existing.grade;
        if (newPoints < 0) newPoints = 0;
        dbRun('UPDATE users SET points = ? WHERE id = ?', [newPoints, req.user.id]);
      }
    }

    dbRun('DELETE FROM submissions WHERE id = ?', [existing.id]);
    logAudit(req.user.id, 'submission_delete', { taskId, taskTitle: task ? task.title : 'Unknown' }, req);
    res.json({ message: 'تم إلغاء التسليم بنجاح' });
  } catch (error) {
    logger.error('Cancel submission error: %s', error.stack);
    res.status(500).json({ error: 'حدث خطأ أثناء إلغاء التسليم' });
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
    logger.error('Leaderboard error: %s', error.stack);
    res.status(500).json({ error: 'حدث خطأ في جلب الليدر بورد' });
  }
});

app.get('/api/admin/submissions', authenticateToken, requireViewerOrAdmin, (req, res) => {
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
    logger.error('Admin submissions error: %s', error.stack);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

app.put('/api/admin/submissions/:id/grade', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { grade } = req.body;
    const newGrade = parseInt(grade);
    if (isNaN(newGrade) || newGrade < 0 || newGrade > 50) {
      return res.status(400).json({ error: 'التقييم يجب أن يكون بين 0 و 50' });
    }

    const sub = dbGet('SELECT * FROM submissions WHERE id = ?', [req.params.id]);
    if (!sub) return res.status(404).json({ error: 'التسليم غير موجود' });

    const student = dbGet('SELECT points FROM users WHERE id = ?', [sub.userId]);
    if (student) {
      const oldGrade = sub.grade || 0;
      let newPoints = student.points - oldGrade + newGrade;
      if (newPoints < 0) newPoints = 0;
      
      dbRun('UPDATE users SET points = ? WHERE id = ?', [newPoints, sub.userId]);
    }

    dbRun('UPDATE submissions SET grade = ? WHERE id = ?', [newGrade, req.params.id]);
    logAudit(req.user.id, 'grade_submission', { submissionId: req.params.id, grade: newGrade, studentId: sub.userId }, req);

    res.json({ message: 'تم التقييم بنجاح', grade: newGrade });
  } catch (error) {
    logger.error('Grade error: %s', error.stack);
    res.status(500).json({ error: 'حدث خطأ أثناء التقييم' });
  }
});

app.get('/api/admin/students', authenticateToken, requireViewerOrAdmin, (req, res) => {
  try {
    const students = dbAll(`
      SELECT u.id, u.name, u.username, u.points, u.fill_card_count,
             COUNT(s.id) as submissionsCount
      FROM users u 
      LEFT JOIN submissions s ON u.id = s.userId
      WHERE u.role = 'student'
      GROUP BY u.id
      ORDER BY u.name ASC
    `);

    res.json(students);
  } catch (error) {
    logger.error('Admin students error: %s', error.stack);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

app.put('/api/admin/students/:id/fill-card', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { action } = req.body; // 'increment' or 'decrement'
    const student = dbGet('SELECT fill_card_count FROM users WHERE id = ? AND role = ?', [req.params.id, 'student']);
    if (!student) return res.status(404).json({ error: 'الطالب غير موجود' });

    let newCount = student.fill_card_count || 0;
    if (action === 'increment' && newCount < 12) newCount++;
    if (action === 'decrement' && newCount > 0) newCount--;

    dbRun('UPDATE users SET fill_card_count = ? WHERE id = ?', [newCount, req.params.id]);
    logAudit(req.user.id, 'student_fill_card', { studentId: req.params.id, action, fillCardCount: newCount }, req);
    res.json({ message: 'تم التحديث بنجاح', fill_card_count: newCount });
  } catch (error) {
    logger.error('Update fill card error: %s', error.stack);
    res.status(500).json({ error: 'حدث خطأ أثناء تحديث الفيل كارد' });
  }
});

app.delete('/api/admin/students/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const student = dbGet('SELECT id, name, username FROM users WHERE id = ? AND role = ?', [req.params.id, 'student']);
    if (!student) return res.status(404).json({ error: 'الطالب غير موجود' });
    
    // Submissions, ratings, and attendance are cascade deleted due to FOREIGN KEY ON DELETE CASCADE
    // However, SQLite FOREIGN KEY support needs to be enabled for it to work. 
    // It is enabled in database.js, but let's be explicit just in case.
    dbRun('DELETE FROM attendance_records WHERE studentId = ?', [req.params.id]);
    dbRun('DELETE FROM submissions WHERE userId = ?', [req.params.id]);
    dbRun('DELETE FROM ratings WHERE userId = ?', [req.params.id]);
    dbRun('DELETE FROM users WHERE id = ?', [req.params.id]);
    
    logAudit(req.user.id, 'student_delete', { studentId: req.params.id, username: student.username, name: student.name }, req);
    res.json({ message: 'تم حذف الطالب بنجاح' });
  } catch (error) {
    logger.error('Delete student error: %s', error.stack);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

app.post('/api/admin/students', authenticateToken, requireAdmin, (req, res) => {
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
    
    logAudit(req.user.id, 'student_create', { username: cleanUsername, name: cleanName, points: p }, req);
    res.json({ message: 'تم إضافة الطالب بنجاح' });
  } catch (err) {
    logger.error('Add student error: %s', err.stack);
    res.status(500).json({ error: 'حدث خطأ أثناء إضافة الطالب' });
  }
});

app.put('/api/admin/students/:id', authenticateToken, requireAdmin, (req, res) => {
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
    
    logAudit(req.user.id, 'student_update', { studentId: req.params.id, username: cleanUsername, name: cleanName, points: p }, req);
    res.json({ message: 'تم التعديل بنجاح' });
  } catch (err) {
    logger.error('Update student error: %s', err.stack);
    res.status(500).json({ error: 'حدث خطأ أثناء تعديل بيانات الطالب' });
  }
});

app.post('/api/admin/lectures', authenticateToken, requireAdmin, (req, res) => {
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
    
    logAudit(req.user.id, 'lecture_create', { lectureId, title }, req);
    res.json({ message: 'تمت إضافة المحاضرة وجلسة الحضور بنجاح' });
  } catch (err) {
    logger.error('Add lecture error: %s', err.stack);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

app.put('/api/admin/lectures/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { title, description, materialUrl } = req.body;
    dbRun('UPDATE lectures SET title = ?, description = ?, materialUrl = ? WHERE id = ?',
      [sanitize(title), sanitize(description), sanitize(materialUrl), req.params.id]);
    
    logAudit(req.user.id, 'lecture_update', { lectureId: req.params.id, title }, req);
    res.json({ message: 'تم التعديل بنجاح' });
  } catch (err) {
    logger.error('Update lecture error: %s', err.stack);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

app.delete('/api/admin/lectures/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const lecture = dbGet('SELECT id, title FROM lectures WHERE id = ?', [req.params.id]);
    if (!lecture) return res.status(404).json({ error: 'المحاضرة غير موجودة' });
    
    dbRun('DELETE FROM ratings WHERE lectureId = ?', [req.params.id]);
    dbRun('DELETE FROM lectures WHERE id = ?', [req.params.id]);
    
    logAudit(req.user.id, 'lecture_delete', { lectureId: req.params.id, title: lecture.title }, req);
    res.json({ message: 'تم حذف المحاضرة بنجاح' });
  } catch (err) {
    logger.error('Delete lecture error: %s', err.stack);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

app.post('/api/lectures/:id/rate', authenticateToken, requireStudent, (req, res) => {
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
    
    logAudit(req.user.id, 'lecture_rate', { lectureId, rating }, req);
    res.json({ message: 'تم حفظ التقييم' });
  } catch (err) {
    logger.error('Rate lecture error: %s', err.stack);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

app.get('/api/lectures/:id/my-rating', authenticateToken, (req, res) => {
  try {
    const ratingData = dbGet('SELECT rating, comment FROM ratings WHERE userId = ? AND lectureId = ?', [req.user.id, req.params.id]);
    res.json({ rating: ratingData ? ratingData.rating : 0, comment: ratingData ? ratingData.comment : '' });
  } catch (err) {
    logger.error('Get my rating error: %s', err.stack);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

app.get('/api/admin/lectures/:id/ratings', authenticateToken, requireViewerOrAdmin, (req, res) => {
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
    logger.error('Get lecture ratings error: %s', err.stack);
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
    logger.error('Tasks error: %s', error.stack);
    res.status(500).json({ error: 'حدث خطأ في جلب المهام' });
  }
});

app.post('/api/admin/tasks', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { title, description, taskUrl } = req.body;
    if (!title || !taskUrl) return res.status(400).json({ error: 'العنوان ورابط المهمة مطلوبان' });
    
    const result = dbRun('INSERT INTO tasks (title, description, taskUrl) VALUES (?, ?, ?)', 
      [sanitize(title), sanitize(description), sanitize(taskUrl)]);
    
    logAudit(req.user.id, 'task_create', { taskId: result.lastInsertRowid, title }, req);
    res.json({ message: 'تمت إضافة المهمة بنجاح' });
  } catch (err) {
    logger.error('Create task error: %s', err.stack);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

app.put('/api/admin/tasks/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { title, description, taskUrl } = req.body;
    dbRun('UPDATE tasks SET title = ?, description = ?, taskUrl = ? WHERE id = ?',
      [sanitize(title), sanitize(description), sanitize(taskUrl), req.params.id]);
    
    logAudit(req.user.id, 'task_update', { taskId: req.params.id, title }, req);
    res.json({ message: 'تم التعديل بنجاح' });
  } catch (err) {
    logger.error('Update task error: %s', err.stack);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

app.delete('/api/admin/tasks/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const task = dbGet('SELECT id, title FROM tasks WHERE id = ?', [req.params.id]);
    if (!task) return res.status(404).json({ error: 'المهمة غير موجودة' });
    
    dbRun('DELETE FROM submissions WHERE taskId = ?', [req.params.id]);
    dbRun('DELETE FROM tasks WHERE id = ?', [req.params.id]);
    
    logAudit(req.user.id, 'task_delete', { taskId: req.params.id, title: task.title }, req);
    res.json({ message: 'تم حذف المهمة بنجاح' });
  } catch (err) {
    logger.error('Delete task error: %s', err.stack);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// =======================
// مسارات الحضور (Attendance)
// =======================

// --- List all sessions with stats ---
app.get('/api/admin/attendance/sessions', authenticateToken, requireViewerOrAdmin, (req, res) => {
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
    logger.error('Attendance sessions error: %s', error.stack);
    res.status(500).json({ error: 'حدث خطأ في جلب جلسات الحضور' });
  }
});

// --- Create session ---
app.post('/api/admin/attendance/sessions', authenticateToken, requireAdmin, (req, res) => {
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

    logAudit(req.user.id, 'attendance_session_create', { sessionId: result.lastInsertRowid, title, attendanceDate }, req);
    res.status(201).json({ message: 'تم إنشاء جلسة الحضور بنجاح', id: result.lastInsertRowid });
  } catch (error) {
    logger.error('Create attendance session error: %s', error.stack);
    res.status(500).json({ error: 'حدث خطأ أثناء إنشاء الجلسة' });
  }
});

// --- Update session ---
app.put('/api/admin/attendance/sessions/:id', authenticateToken, requireAdmin, (req, res) => {
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

    logAudit(req.user.id, 'attendance_session_update', { sessionId: req.params.id, title, attendanceDate }, req);
    res.json({ message: 'تم تعديل الجلسة بنجاح' });
  } catch (error) {
    logger.error('Update attendance session error: %s', error.stack);
    res.status(500).json({ error: 'حدث خطأ أثناء تعديل الجلسة' });
  }
});

// --- Delete session (with full points rollback) ---
app.delete('/api/admin/attendance/sessions/:id', authenticateToken, requireAdmin, (req, res) => {
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
    
    logAudit(req.user.id, 'attendance_session_delete', { sessionId: req.params.id, title: session.title }, req);
    res.json({ message: 'تم حذف الجلسة واستعادة النقاط بنجاح' });
  } catch (error) {
    logger.error('Delete attendance session error: %s', error.stack);
    res.status(500).json({ error: 'حدث خطأ أثناء حذف الجلسة' });
  }
});

// --- Lock/Unlock session ---
app.put('/api/admin/attendance/sessions/:id/lock', authenticateToken, requireAdmin, (req, res) => {
  try {
    const session = dbGet('SELECT * FROM attendance_sessions WHERE id = ?', [req.params.id]);
    if (!session) return res.status(404).json({ error: 'الجلسة غير موجودة' });

    const newLocked = session.isLocked ? 0 : 1;
    dbRun('UPDATE attendance_sessions SET isLocked = ? WHERE id = ?', [newLocked, req.params.id]);

    logAudit(req.user.id, newLocked ? 'attendance_session_lock' : 'attendance_session_unlock', { sessionId: req.params.id, title: session.title }, req);
    res.json({
      message: newLocked ? 'تم قفل الجلسة بنجاح' : 'تم فتح الجلسة بنجاح',
      isLocked: !!newLocked
    });
  } catch (error) {
    logger.error('Lock attendance session error: %s', error.stack);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// --- Get records for a session ---
app.get('/api/admin/attendance/sessions/:id/records', authenticateToken, requireViewerOrAdmin, (req, res) => {
  try {
    const session = dbGet('SELECT * FROM attendance_sessions WHERE id = ?', [req.params.id]);
    if (!session) return res.status(404).json({ error: 'الجلسة غير موجودة' });

    // Get all students with their attendance status for this session
    const students = dbAll(`
      SELECT u.id, u.name, u.username, u.points,
             ar.status, ar.awardedPoints, ar.notes, ar.id as recordId
      FROM users u
      LEFT JOIN attendance_records ar ON u.id = ar.studentId AND ar.sessionId = ?
      WHERE u.role = 'student'
      ORDER BY u.name ASC
    `, [req.params.id]);

    res.json({ session, students });
  } catch (error) {
    logger.error('Attendance records error: %s', error.stack);
    res.status(500).json({ error: 'حدث خطأ في جلب سجلات الحضور' });
  }
});

// --- Bulk mark attendance ---
app.post('/api/admin/attendance/sessions/:id/records', authenticateToken, requireAdmin, (req, res) => {
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
      const notes = sanitize(rec.notes || '');

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

          dbRun('UPDATE attendance_records SET status = ?, awardedPoints = ?, notes = ? WHERE id = ?', [status, newAward, notes, existing.id]);
        } else if (existing.notes !== notes) {
          dbRun('UPDATE attendance_records SET notes = ? WHERE id = ?', [notes, existing.id]);
        }
      } else {
        // New record
        const award = status === 'present' ? session.bonusPoints : (status === 'late' ? session.latePoints : 0);
        dbRun(
          'INSERT INTO attendance_records (sessionId, studentId, status, awardedPoints, notes) VALUES (?, ?, ?, ?, ?)',
          [req.params.id, studentId, status, award, notes]
        );
        if (award > 0) {
          dbRun('UPDATE users SET points = points + ? WHERE id = ?', [award, studentId]);
          pointsChanged += award;
        }
      }
    }

    logAudit(req.user.id, 'attendance_records_mark', { sessionId: req.params.id, title: session.title, recordsCount: records.length, pointsChanged }, req);
    res.json({ message: 'تم حفظ الحضور بنجاح', pointsChanged });
  } catch (error) {
    logger.error('Mark attendance error: %s', error.stack);
    res.status(500).json({ error: 'حدث خطأ أثناء حفظ الحضور' });
  }
});

// --- Attendance analytics ---
app.get('/api/admin/attendance/analytics', authenticateToken, requireViewerOrAdmin, (req, res) => {
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
    logger.error('Attendance analytics error: %s', error.stack);
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
    logger.error('Student attendance error: %s', error.stack);
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
app.get('/api/admin/export', authenticateToken, requireAdmin, (req, res) => {
  try {
    const scope = ['full', 'users', 'content', 'submissions'].includes(req.query.scope)
      ? req.query.scope : 'full';

    const payload = buildExportPayload(scope);
    const json = JSON.stringify(payload, null, 2);
    const date = new Date().toISOString().slice(0, 10);
    const filename = `lms-backup-${scope}-${date}.json`;

    logAudit(req.user.id, 'db_export', { scope, filename }, req);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(json);
  } catch (error) {
    logger.error('Export error: %s', error.stack);
    res.status(500).json({ error: 'حدث خطأ أثناء تصدير البيانات' });
  }
});

// --- Validate / Dry-Run ---
app.post('/api/admin/validate-backup', authenticateToken, requireAdmin, express.json({ limit: '50mb' }), (req, res) => {
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
    logger.error('Validate error: %s', error.stack);
    res.status(500).json({ error: 'حدث خطأ أثناء التحقق من الملف' });
  }
});

// --- Import / Restore ---
app.post('/api/admin/import', authenticateToken, requireAdmin, express.json({ limit: '50mb' }), (req, res) => {
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
    logger.info(`[Import] Pre-import backup saved: ${backupFilename}`);

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
      logger.error('Import failed, attempting auto-rollback: %s', importError.stack);

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

        logger.info('[Import Rollback] Auto-rollback successful — data restored to pre-import state');
        return res.status(500).json({
          error: 'فشل الاستيراد — تم استعادة البيانات السابقة تلقائياً',
          rollback: true,
          details: importError.message,
        });
      } catch (rollbackError) {
        logger.error('CRITICAL: Rollback also failed: %s', rollbackError.stack);
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
      logger.info('[Import] Import completed successfully: %o', summary);
      logAudit(req.user.id, 'db_import', { summary, preImportBackup: backupFilename }, req);
      res.json({
        message: 'تم استيراد البيانات بنجاح',
        summary,
        backupFile: backupFilename,
      });
    }
  } catch (error) {
    logger.error('Import error: %s', error.stack);
    res.status(500).json({ error: 'حدث خطأ أثناء استيراد البيانات' });
  }
});

// --- Backup History ---
app.get('/api/admin/backups', authenticateToken, requireAdmin, (req, res) => {
  try {
    ensureBackupsDir();
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.endsWith('.json') || f.endsWith('.db'))
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
    logger.error('Backup list error: %s', error.stack);
    res.status(500).json({ error: 'حدث خطأ في جلب قائمة النسخ الاحتياطية' });
  }
});

// --- Download Backup ---
app.get('/api/admin/backups/:filename', authenticateToken, requireAdmin, (req, res) => {
  try {
    const filename = path.basename(req.params.filename); // Prevent path traversal
    if (!filename.endsWith('.json') && !filename.endsWith('.db')) {
      return res.status(400).json({ error: 'نوع الملف غير مدعوم' });
    }

    const filePath = path.join(BACKUPS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'النسخة الاحتياطية غير موجودة' });
    }

    logAudit(req.user.id, 'db_backup_download', { filename }, req);

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    if (filename.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    } else {
      res.setHeader('Content-Type', 'application/octet-stream');
    }
    res.sendFile(filePath);
  } catch (error) {
    logger.error('Backup download error: %s', error.stack);
    res.status(500).json({ error: 'حدث خطأ أثناء تحميل النسخة الاحتياطية' });
  }
});

// --- Delete Backup ---
app.delete('/api/admin/backups/:filename', authenticateToken, requireAdmin, (req, res) => {
  try {
    const filename = path.basename(req.params.filename); // Prevent path traversal
    if (!filename.endsWith('.json') && !filename.endsWith('.db')) {
      return res.status(400).json({ error: 'نوع الملف غير مدعوم' });
    }

    const filePath = path.join(BACKUPS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'النسخة الاحتياطية غير موجودة' });
    }

    fs.unlinkSync(filePath);
    logAudit(req.user.id, 'db_backup_delete', { filename }, req);
    res.json({ message: 'تم حذف النسخة الاحتياطية بنجاح' });
  } catch (error) {
    logger.error('Backup delete error: %s', error.stack);
    res.status(500).json({ error: 'حدث خطأ أثناء حذف النسخة الاحتياطية' });
  }
});

// ==============================
// Automatic SQLite Backup Scheduler
// ==============================
function runDatabaseBackup() {
  try {
    ensureBackupsDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `auto-backup-${timestamp}.db`;
    const destPath = path.join(BACKUPS_DIR, filename);

    logger.info(`[Backup] Starting automatic database backup...`);
    dbBackup(destPath)
      .then(() => {
        logger.info(`[Backup] Database backup completed successfully: ${filename}`);
        cleanupOldBackups();
      })
      .catch(err => {
        logger.error(`[Backup Error] Database backup failed: %s`, err.stack);
      });
  } catch (err) {
    logger.error(`[Backup Error] Failed to launch database backup: %s`, err.stack);
  }
}

function cleanupOldBackups() {
  try {
    ensureBackupsDir();
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.startsWith('auto-backup-') && f.endsWith('.db'))
      .map(filename => {
        const filePath = path.join(BACKUPS_DIR, filename);
        const stats = fs.statSync(filePath);
        return { filename, filePath, mtime: stats.mtime };
      })
      .sort((a, b) => b.mtime - a.mtime); // Newest first

    if (files.length > 10) {
      const toDelete = files.slice(10);
      for (const file of toDelete) {
        fs.unlinkSync(file.filePath);
        logger.info(`[Backup Cleanup] Deleted old database backup: ${file.filename}`);
      }
    }
  } catch (err) {
    logger.error(`[Backup Cleanup Error] Failed to cleanup old backups: %s`, err.stack);
  }
}

function scheduleAutoBackup() {
  // Run once immediately on startup
  runDatabaseBackup();
  // Schedule to run every 24 hours (24 * 60 * 60 * 1000 ms)
  setInterval(() => {
    runDatabaseBackup();
  }, 24 * 60 * 60 * 1000);
}

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
  logger.error('Unhandled server error: %s', err.stack);
  res.status(500).json({ error: 'حدث خطأ غير متوقع في الخادم' });
});

// ==============================
// Start Server
// ==============================
async function startServer() {
  try {
    // اتصال قاعدة البيانات أولاً
    await setupDB();
    logger.info('Database connected successfully!');

    // Initialize auto-backup scheduler
    scheduleAutoBackup();

    // ثم بدء السيرفر
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Server running perfectly on port ${PORT}!`);
      logger.info(`Main Website: http://localhost:${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (err) {
    logger.error('Failed to start server: %s', err.stack);
    process.exit(1);
  }
}

startServer();
