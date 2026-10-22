const { spawn } = require('node:child_process');
const path = require('node:path');
const net = require('node:net');
const root = path.resolve(__dirname, '..');
const port = 5221;
async function freePort() {
  await new Promise((resolve, reject) => {
    const check = net.createServer(); check.once('error', reject);
    check.listen(port, '127.0.0.1', () => check.close(resolve));
  });
}
async function withWildlingServer(run) {
  await freePort();
  const server = spawn('nice', ['-n', '10', process.execPath, path.join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; server.stdout.on('data', d => output += d); server.stderr.on('data', d => output += d);
  const stop = () => { if (server.exitCode === null) server.kill('SIGTERM'); };
  const interrupted = () => { stop(); process.exitCode = 130; };
  process.once('SIGINT', interrupted); process.once('SIGTERM', interrupted);
  try {
    const deadline = Date.now() + 15000;
    while (true) {
      if (server.exitCode !== null) throw new Error(`Preview exited: ${output}`);
      try { const response = await fetch(`http://127.0.0.1:${port}/`); if (response.ok) break; } catch {}
      if (Date.now() > deadline) throw new Error(`Preview timeout: ${output}`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return await run(`http://127.0.0.1:${port}/`);
  } finally {
    stop();
    if (server.exitCode === null) await Promise.race([new Promise(resolve => server.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 2500))]);
    if (server.exitCode === null && server.signalCode === null) server.kill('SIGKILL');
    process.removeListener('SIGINT', interrupted); process.removeListener('SIGTERM', interrupted);
  }
}
module.exports = { withWildlingServer };
