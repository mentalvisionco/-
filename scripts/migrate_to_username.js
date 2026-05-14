const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.sqlite');
console.log(`Connecting to database at: ${dbPath}`);

try {
  const db = new Database(dbPath, { fileMustExist: true });
  
  // Check if column 'email' exists
  const columnsInfo = db.prepare('PRAGMA table_info(users)').all();
  const hasEmail = columnsInfo.some(col => col.name === 'email');
  
  if (hasEmail) {
    console.log('Found "email" column in "users" table. Renaming to "username"...');
    
    // SQLite doesn't directly support changing the constraint (e.g. from email@xx to username uniqueness might fail if we change the format later, but UNIQUE is preserved on rename)
    // We will just rename the column.
    db.exec('ALTER TABLE users RENAME COLUMN email TO username;');
    
    // Let's also remove the @lms.com suffix from existing users to make them standard usernames
    console.log('Updating existing users to strip "@lms.com" domain (if any)...');
    
    const users = db.prepare('SELECT id, username FROM users').all();
    const updateStmt = db.prepare('UPDATE users SET username = ? WHERE id = ?');
    
    let updatedCount = 0;
    for (const user of users) {
      if (user.username && user.username.includes('@')) {
        const newUsername = user.username.split('@')[0];
        // Ensure newUsername is unique, but for this small script it should be fine.
        try {
          updateStmt.run(newUsername, user.id);
          updatedCount++;
        } catch (err) {
          console.error(`Could not update user ${user.id} username to ${newUsername}:`, err.message);
        }
      }
    }
    
    console.log(`✅ Successfully renamed column and updated ${updatedCount} usernames.`);
  } else {
    console.log('✅ "users" table does not have an "email" column (already migrated).');
  }
  
  db.close();
} catch (error) {
  console.error('Migration failed:', error.message);
}
