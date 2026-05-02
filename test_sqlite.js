const { setupDB, dbRun, dbGet } = require('./database');

async function test() {
  const db = await setupDB();
  db.run('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', ['Test', 'test_' + Date.now() + '@test.com', 'pass', 'student']);
  console.log("Direct last_insert_rowid:", db.exec('SELECT last_insert_rowid()')[0].values[0][0]);
}
test();
