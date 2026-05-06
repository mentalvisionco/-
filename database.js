const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

let db = null;

async function setupDB() {
  const dbPath = process.env.DB_PATH || path.join(__dirname, 'database.sqlite');
  
  db = new Database(dbPath, { verbose: null });
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create Tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'student' CHECK(role IN ('student', 'admin', 'viewer')),
      points INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lectures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      videoUrl TEXT,
      orderNum INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

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
    );

    CREATE TABLE IF NOT EXISTS ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      lectureId INTEGER NOT NULL,
      rating INTEGER CHECK(rating >= 1 AND rating <= 5),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(lectureId) REFERENCES lectures(id) ON DELETE CASCADE,
      UNIQUE(userId, lectureId)
    );
  `);

  // Default Users
  const count = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  
  if (count === 0) {
    const adminPass = bcrypt.hashSync('12345678', 10);
    const studentPass = bcrypt.hashSync('12345678', 10);

    const insertUser = db.prepare('INSERT INTO users (name, email, password, role, points) VALUES (?, ?, ?, ?, ?)');
    insertUser.run('مدير النظام', 'admin@lms.com', adminPass, 'admin', 0);
    insertUser.run('طالب تجريبي', 'student@lms.com', studentPass, 'student', 150);
    
    console.log('✅ Default users created (admin@lms.com / student@lms.com - password: 12345678)');
  }

  // Default Lectures
  const lecCount = db.prepare('SELECT COUNT(*) as count FROM lectures').get().count;
  if (lecCount === 0) {
    const lectures = [
      ['المحاضرة الأولى: مقدمة', 'أساسيات النظام', 'https://www.w3schools.com/html/mov_bbb.mp4', 1],
      ['المحاضرة الثانية: التصميم', 'الـ UI/UX', 'https://www.w3schools.com/html/mov_bbb.mp4', 2],
      ['المحاضرة الثالثة: البرمجة', 'أساسيات JS', 'https://www.w3schools.com/html/mov_bbb.mp4', 3]
    ];

    const insertLec = db.prepare('INSERT INTO lectures (title, description, videoUrl, orderNum) VALUES (?, ?, ?, ?)');
    for (const lec of lectures) {
      insertLec.run(...lec);
    }
    console.log('✅ Default lectures created');
  }

  return db;
}

// Helpers
function dbGet(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.get(...params);
}

function dbAll(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.all(...params);
}

function dbRun(sql, params = []) {
  const stmt = db.prepare(sql);
  const info = stmt.run(...params);
  return {
    lastInsertRowid: info.lastInsertRowid,
    changes: info.changes
  };
}

module.exports = { setupDB, dbGet, dbAll, dbRun };
