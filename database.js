const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const bcrypt = require('bcryptjs');

async function setupDB() {
  const dbPath = process.env.DB_PATH || './database.sqlite';
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // إنشاء جدول المستخدمين
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'student',
      points INTEGER DEFAULT 0
    )
  `);

  // إنشاء جدول المحاضرات
  await db.exec(`
    CREATE TABLE IF NOT EXISTS lectures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      videoUrl TEXT,
      orderNum INTEGER
    )
  `);

  // إنشاء جدول التسليمات
  await db.exec(`
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      lectureId INTEGER,
      fileUrl TEXT,
      grade INTEGER,
      feedback TEXT,
      FOREIGN KEY(userId) REFERENCES users(id),
      FOREIGN KEY(lectureId) REFERENCES lectures(id)
    )
  `);

  // إضافة البيانات الافتراضية إذا كانت الجداول فارغة
  const usersCount = await db.get('SELECT COUNT(*) as count FROM users');
  if (usersCount.count === 0) {
    const adminPass = await bcrypt.hash('123', 10);
    const studentPass = await bcrypt.hash('123', 10);
    await db.run(`INSERT INTO users (name, email, password, role, points) VALUES (?, ?, ?, ?, ?)`, ['مدير النظام', 'admin@lms.com', adminPass, 'admin', 0]);
    await db.run(`INSERT INTO users (name, email, password, role, points) VALUES (?, ?, ?, ?, ?)`, ['طالب تجريبي', 'student@lms.com', studentPass, 'student', 150]);
  }

  const lecturesCount = await db.get('SELECT COUNT(*) as count FROM lectures');
  if (lecturesCount.count === 0) {
    const lectures = [
      ['المحاضرة الأولى: مقدمة', 'أساسيات النظام', 'video1.mp4', 1],
      ['المحاضرة الثانية: التصميم', 'الـ UI/UX', 'video2.mp4', 2],
      ['المحاضرة الثالثة: البرمجة', 'أساسيات JS', 'video3.mp4', 3]
    ];
    for (const lec of lectures) {
      await db.run(`INSERT INTO lectures (title, description, videoUrl, orderNum) VALUES (?, ?, ?, ?)`, lec);
    }
  }

  return db;
}

module.exports = setupDB;
