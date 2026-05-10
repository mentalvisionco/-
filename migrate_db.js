const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath, { verbose: console.log });

try {
  // Rename videoUrl to materialUrl in lectures (SQLite doesn't support RENAME COLUMN easily if older version, but let's try ALTER TABLE ... RENAME COLUMN)
  try {
    db.exec('ALTER TABLE lectures RENAME COLUMN videoUrl TO materialUrl');
    console.log('Renamed videoUrl to materialUrl');
  } catch (err) {
    console.log('Column might already be renamed or not supported: ', err.message);
  }

  // Create tasks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      taskUrl TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('Created tasks table');

  // Re-create submissions table to use taskId instead of lectureId
  db.exec('DROP TABLE IF EXISTS submissions');
  db.exec(`
    CREATE TABLE submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      taskId INTEGER NOT NULL,
      fileUrl TEXT NOT NULL,
      grade INTEGER,
      feedback TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(taskId) REFERENCES tasks(id) ON DELETE CASCADE
    );
  `);
  console.log('Recreated submissions table with taskId');

  console.log('Migration completed successfully');
} catch (err) {
  console.error('Migration failed:', err.message);
}
db.close();
