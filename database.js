const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

let db = null;

async function setupDB() {
  const dbPath = process.env.DB_PATH || path.join(__dirname, 'database.sqlite');
  
  const SQL = await initSqlJs();
  
  // محاولة تحميل قاعدة بيانات موجودة
  try {
    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(fileBuffer);
      console.log('📂 Loaded existing database from disk');
    } else {
      db = new SQL.Database();
      console.log('🆕 Created new database');
    }
  } catch (err) {
    console.warn('⚠️ Could not load existing DB, creating new one:', err.message);
    db = new SQL.Database();
  }

  // تفعيل foreign keys
  db.run('PRAGMA foreign_keys = ON');

  // إنشاء الجداول
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'student' CHECK(role IN ('student', 'admin')),
      points INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS lectures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      videoUrl TEXT,
      orderNum INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      lectureId INTEGER NOT NULL,
      fileUrl TEXT NOT NULL,
      grade INTEGER,
      feedback TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(lectureId) REFERENCES lectures(id) ON DELETE CASCADE
    )
  `);

  // إضافة البيانات الافتراضية إذا كانت الجداول فارغة
  const usersCount = db.exec('SELECT COUNT(*) as count FROM users');
  const count = usersCount[0].values[0][0];
  
  if (count === 0) {
    const adminPass = bcrypt.hashSync('123', 10);
    const studentPass = bcrypt.hashSync('123', 10);

    db.run(
      'INSERT INTO users (name, email, password, role, points) VALUES (?, ?, ?, ?, ?)',
      ['مدير النظام', 'admin@lms.com', adminPass, 'admin', 0]
    );
    db.run(
      'INSERT INTO users (name, email, password, role, points) VALUES (?, ?, ?, ?, ?)',
      ['طالب تجريبي', 'student@lms.com', studentPass, 'student', 150]
    );
    
    console.log('✅ Default users created (admin@lms.com / student@lms.com - password: 123)');
  }

  const lecturesCount = db.exec('SELECT COUNT(*) as count FROM lectures');
  const lecCount = lecturesCount[0].values[0][0];
  
  if (lecCount === 0) {
    const lectures = [
      ['المحاضرة الأولى: مقدمة', 'أساسيات النظام', 'video1.mp4', 1],
      ['المحاضرة الثانية: التصميم', 'الـ UI/UX', 'video2.mp4', 2],
      ['المحاضرة الثالثة: البرمجة', 'أساسيات JS', 'video3.mp4', 3]
    ];

    for (const lec of lectures) {
      db.run(
        'INSERT INTO lectures (title, description, videoUrl, orderNum) VALUES (?, ?, ?, ?)',
        lec
      );
    }
    
    console.log('✅ Default lectures created');
  }

  // حفظ قاعدة البيانات على القرص
  saveDB(dbPath);

  return db;
}

// حفظ قاعدة البيانات على القرص
function saveDB(dbPath) {
  if (!db) return;
  try {
    const filePath = dbPath || process.env.DB_PATH || path.join(__dirname, 'database.sqlite');
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(filePath, buffer);
  } catch (err) {
    console.error('Error saving database:', err.message);
  }
}

// ==============================
// Helper functions لتسهيل الاستخدام
// ==============================

// استعلام يعود بصف واحد
function dbGet(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

// استعلام يعود بجميع الصفوف
function dbAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// استعلام تنفيذي (INSERT, UPDATE, DELETE)
function dbRun(sql, params = []) {
  db.run(sql, params);
  // حفظ البيانات بعد كل تغيير
  const dbPath = process.env.DB_PATH || path.join(__dirname, 'database.sqlite');
  saveDB(dbPath);
  return {
    lastInsertRowid: db.exec('SELECT last_insert_rowid()')[0].values[0][0],
    changes: db.getRowsModified()
  };
}

module.exports = { setupDB, dbGet, dbAll, dbRun, saveDB };
