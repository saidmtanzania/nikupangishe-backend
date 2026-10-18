const { spawn } = require('node:child_process');

const child = spawn(process.execPath, ['dist/database/start-production.js'], {
  stdio: ['ignore', 'pipe', 'pipe'],
});

let started = false;

function finish(code) {
  child.kill('SIGTERM');
  process.exit(code);
}

async function checkHealth() {
  try {
    const live = await fetch('http://127.0.0.1:3000/api/v1/health/live');
    const ready = await fetch('http://127.0.0.1:3000/api/v1/health/ready');
    console.log(`LIVE_STATUS=${live.status}`);
    console.log(`READY_STATUS=${ready.status}`);
    console.log(await ready.text());
    finish(live.ok && ready.ok ? 0 : 1);
  } catch (error) {
    console.error(error);
    finish(1);
  }
}

child.stdout.on('data', (chunk) => {
  const output = chunk.toString();
  if (!started && output.includes('API running on:')) {
    started = true;
    void checkHealth();
  }
});

child.stderr.on('data', (chunk) => process.stderr.write(chunk));
child.on('exit', (code) => {
  if (!started) process.exit(code || 1);
});

setTimeout(() => {
  console.error('API startup timeout');
  finish(1);
}, 20000);
