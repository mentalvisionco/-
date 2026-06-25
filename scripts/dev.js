const { spawn } = require('child_process');

console.log('\x1b[35m%s\x1b[0m', '🚀 Starting LMS Platform (Backend on port 5000 & Frontend on port 3000)...');

// Start the Express Backend
const backend = spawn('node', ['server.js'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true
});

// Start the Next.js Frontend
const frontend = spawn('npm', ['run', 'dev'], {
  cwd: './client',
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true
});

function logData(prefix, color, data) {
  const lines = data.toString().split('\n');
  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed) {
      console.log(`${color}${prefix}\x1b[0m | ${line}`);
    }
  });
}

backend.stdout.on('data', (data) => logData('[Backend]', '\x1b[36m', data));
backend.stderr.on('data', (data) => logData('[Backend-Error]', '\x1b[31m', data));

frontend.stdout.on('data', (data) => logData('[Frontend]', '\x1b[32m', data));
frontend.stderr.on('data', (data) => logData('[Frontend-Error]', '\x1b[31m', data));

const cleanup = () => {
  console.log('\n\x1b[35m%s\x1b[0m', 'Shutting down server processes...');
  backend.kill();
  frontend.kill();
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
