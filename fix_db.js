const db = require('better-sqlite3')('database.sqlite');
db.pragma('foreign_keys = OFF');
db.transaction(() => {
  // Recreate submissions
  db.exec(`
    CREATE TABLE new_submissions (
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
  db.exec('INSERT INTO new_submissions SELECT * FROM submissions');
  db.exec('DROP TABLE submissions');
  db.exec('ALTER TABLE new_submissions RENAME TO submissions');

  // Recreate ratings
  db.exec(`
    CREATE TABLE new_ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      lectureId INTEGER NOT NULL,
      rating INTEGER CHECK(rating >= 1 AND rating <= 5),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      comment TEXT,
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(lectureId) REFERENCES lectures(id) ON DELETE CASCADE,
      UNIQUE(userId, lectureId)
    )
  `);
  db.exec('INSERT INTO new_ratings SELECT * FROM ratings');
  db.exec('DROP TABLE ratings');
  db.exec('ALTER TABLE new_ratings RENAME TO ratings');
})();
db.pragma('foreign_keys = ON');
console.log('Database schema fixed!');
