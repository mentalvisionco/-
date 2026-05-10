const db = require('better-sqlite3')('database.sqlite');
console.log(db.prepare("SELECT sql FROM sqlite_master WHERE type='table'").all());
