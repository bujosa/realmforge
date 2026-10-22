/* Every QA command owns one bounded preview process, closed by exact PID on all exits. */
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { once } = require('node:events');
const net = require('node:net');
const evidence = path.resolve(process.env.QA_OUTPUT_DIR || 'qa-output');
const port = Number(process.env.QA_PORT || 5232);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('QA_PORT must be an unprivileged TCP port');
const basePath = process.env.QA_BASE_PATH || '/';
if (!basePath.startsWith('/') || !basePath.endsWith('/')) throw new Error('QA_BASE_PATH must start and end with /');
const base = `http://127.0.0.1:${port}${basePath}`;
async function withServer(work) {
  if (!fs.existsSync(path.resolve('dist-gallery/index.html'))) throw new Error('Run npm run build before QA');
  const occupied = await new Promise(resolve => {
    const probe = net.connect(port, '127.0.0.1');
    probe.setTimeout(500);
    probe.once('connect', () => { probe.destroy(); resolve(true); });
    probe.once('error', () => resolve(false));
    probe.once('timeout', () => { probe.destroy(); resolve(false); });
  });
  if (occupied) throw new Error(`Port ${port} is already occupied; QA will not reuse or stop that process`);
  fs.mkdirSync(evidence, { recursive: true });
  const log = fs.openSync(path.join(evidence, 'preview.log'), 'a');
  const server = spawn(process.execPath, [path.resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--base', basePath, '--strictPort'], { cwd: process.cwd(), stdio: ['ignore', log, log] });
  let stopped = false;
  const stop = async () => {
    if (stopped) return; stopped = true;
    if (server.exitCode === null && server.signalCode === null) {
      const exited = once(server, 'exit');
      server.kill('SIGTERM');
      const timer = setTimeout(() => { if (server.exitCode === null && server.signalCode === null) server.kill('SIGKILL'); }, 3000);
      await exited; clearTimeout(timer);
    }
    fs.closeSync(log);
  };
  const interrupt = () => { void stop().finally(() => process.exit(130)); };
  process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (server.exitCode !== null) throw new Error(`Owned preview exited (${server.exitCode}); inspect evidence/preview.log`);
      try { const response = await fetch(base, { signal: AbortSignal.timeout(1000) }); if (response.ok) { ready = true; break; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!ready) throw new Error('Owned preview did not become ready');
    return await work(base);
  } finally {
    await stop();
    process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt);
  }
}
module.exports = { withServer, evidence, base };
