const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new Database(dbPath);

console.log('Starting migration...');

try {
  db.exec('PRAGMA foreign_keys = OFF;');
  db.exec('BEGIN TRANSACTION;');

  db.exec('ALTER TABLE users RENAME TO old_users;');

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
  `);

  db.exec('INSERT INTO users SELECT * FROM old_users;');
  db.exec('DROP TABLE old_users;');

  db.exec('COMMIT;');
  db.exec('PRAGMA foreign_keys = ON;');
  
  console.log('Migration completed successfully!');
} catch (error) {
  db.exec('ROLLBACK;');
  console.error('Migration failed:', error.message);
}
