const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const logger = require('./services/logger');

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
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'student' CHECK(role IN ('student', 'admin', 'viewer')),
      points INTEGER DEFAULT 0,
      fill_card_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lectures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      materialUrl TEXT,
      orderNum INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      taskUrl TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      taskId INTEGER NOT NULL,
      fileUrl TEXT NOT NULL,
      uploadedFileId TEXT,
      uploadedFileUrl TEXT,
      uploadedFileName TEXT,
      storageProvider TEXT,
      grade INTEGER,
      feedback TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(taskId) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      lectureId INTEGER NOT NULL,
      rating INTEGER CHECK(rating >= 1 AND rating <= 5),
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(lectureId) REFERENCES lectures(id) ON DELETE CASCADE,
      UNIQUE(userId, lectureId)
    );

    CREATE TABLE IF NOT EXISTS attendance_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      notes TEXT,
      lectureId INTEGER,
      attendanceDate TEXT NOT NULL,
      bonusPoints INTEGER DEFAULT 10,
      latePoints INTEGER DEFAULT 5,
      isLocked INTEGER DEFAULT 0,
      createdBy INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(lectureId) REFERENCES lectures(id) ON DELETE SET NULL,
      FOREIGN KEY(createdBy) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS attendance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sessionId INTEGER NOT NULL,
      studentId INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'absent' CHECK(status IN ('present', 'absent', 'late')),
      awardedPoints INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(sessionId) REFERENCES attendance_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY(studentId) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(sessionId, studentId)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      userId INTEGER NOT NULL,
      userAgent TEXT,
      ipAddress TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      lastUsed DATETIME DEFAULT CURRENT_TIMESTAMP,
      expiresAt DATETIME NOT NULL,
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      ipAddress TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE SET NULL
    );
  `);

  // Migrate existing database to add notes if it doesn't exist
  try {
    db.exec('ALTER TABLE attendance_records ADD COLUMN notes TEXT');
    console.log('✅ Added notes column to attendance_records');
  } catch (err) {
    // Column already exists or table doesn't exist yet
  }

  // Migrate existing database to add latePoints if it doesn't exist
  try {
    db.exec('ALTER TABLE attendance_sessions ADD COLUMN latePoints INTEGER DEFAULT 5');
    console.log('✅ Added latePoints column to attendance_sessions');
  } catch (err) {
    // Column already exists or table doesn't exist yet
  }

  // Migrate existing database to add fill_card_count if it doesn't exist
  try {
    db.exec('ALTER TABLE users ADD COLUMN fill_card_count INTEGER DEFAULT 0');
    console.log('✅ Added fill_card_count column to users');
  } catch (err) {
    // Column already exists or table doesn't exist yet
  }

  // Migrate existing database to add new submissions columns if they do not exist
  try {
    db.exec('ALTER TABLE submissions ADD COLUMN uploadedFileId TEXT');
    console.log('✅ Added uploadedFileId column to submissions');
  } catch (err) {}
  try {
    db.exec('ALTER TABLE submissions ADD COLUMN uploadedFileUrl TEXT');
    console.log('✅ Added uploadedFileUrl column to submissions');
  } catch (err) {}
  try {
    db.exec('ALTER TABLE submissions ADD COLUMN uploadedFileName TEXT');
    console.log('✅ Added uploadedFileName column to submissions');
  } catch (err) {}
  try {
    db.exec('ALTER TABLE submissions ADD COLUMN storageProvider TEXT');
    console.log('✅ Added storageProvider column to submissions');
  } catch (err) {}

  // Default Users
  const count = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  
  if (count === 0) {
    const adminPass = bcrypt.hashSync('AdminLms2026!', 10);
    const studentPass = bcrypt.hashSync('StudentLms2026!', 10);

    const insertUser = db.prepare('INSERT INTO users (name, username, password, role, points) VALUES (?, ?, ?, ?, ?)');
    insertUser.run('مدير النظام', 'admin', adminPass, 'admin', 0);
    insertUser.run('طالب تجريبي', 'student', studentPass, 'student', 150);
    
    console.log('✅ Default users created (admin: AdminLms2026! / student: StudentLms2026!)');
  }

  // Default Lectures
  const lecCount = db.prepare('SELECT COUNT(*) as count FROM lectures').get().count;
  if (lecCount === 0) {
    const lectures = [
      ['المحاضرة الأولى: مقدمة', 'أساسيات النظام', 'https://www.w3schools.com/html/mov_bbb.mp4', 1],
      ['المحاضرة الثانية: التصميم', 'الـ UI/UX', 'https://www.w3schools.com/html/mov_bbb.mp4', 2],
      ['المحاضرة الثالثة: البرمجة', 'أساسيات JS', 'https://www.w3schools.com/html/mov_bbb.mp4', 3]
    ];

    const insertLec = db.prepare('INSERT INTO lectures (title, description, materialUrl, orderNum) VALUES (?, ?, ?, ?)');
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

function logAudit(userId, action, details = null, req = null) {
  try {
    const ip = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress) : null;
    const detailsStr = details ? (typeof details === 'object' ? JSON.stringify(details) : String(details)) : null;
    dbRun('INSERT INTO audit_logs (userId, action, details, ipAddress) VALUES (?, ?, ?, ?)', [userId, action, detailsStr, ip]);
    logger.info(`[Audit Log] User ID: ${userId || 'SYSTEM'} | Action: ${action} | Details: ${detailsStr || 'None'} | IP: ${ip || 'Unknown'}`);
  } catch (err) {
    logger.error(`[Audit Log Failure] Failed to record audit log for action ${action}: ${err.message}`);
  }
}

async function dbBackup(destPath) {
  if (!db) throw new Error('Database is not initialized');
  return await db.backup(destPath);
}

module.exports = { setupDB, dbGet, dbAll, dbRun, logAudit, dbBackup };
