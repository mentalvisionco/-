const { setupDB, dbGet, dbRun } = require('../database');
const bcrypt = require('bcryptjs');

async function addViewer() {
  await setupDB();
  const existing = dbGet("SELECT id FROM users WHERE email = 'viewer@lms.com'");
  if (!existing) {
    const password = bcrypt.hashSync('12345678', 10);
    dbRun("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)", ['مشاهد تجريبي', 'viewer@lms.com', password, 'viewer']);
    console.log("Viewer added successfully");
  } else {
    console.log("Viewer already exists");
  }
}
addViewer();
