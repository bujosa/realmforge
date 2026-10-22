/* A single, short-lived preview owned by the calling QA process. */
const { spawn } = require('node:child_process');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

async function withArmyServer(url, run) {
  const endpoint = new URL(url);
  const port = Number(endpoint.port);
  if (endpoint.hostname !== '127.0.0.1' || port < 5211 || port > 5219) {
    throw new Error('Army QA must use 127.0.0.1 on ports 5211–5219');
  }
  // An occupied endpoint belongs to someone else; never reuse or terminate it.
  try {
    await fetch(endpoint, { signal: AbortSignal.timeout(700) });
    throw new Error(`QA port ${port} is already occupied`);
  } catch (error) {
    if (error.message.includes('already occupied')) throw error;
  }
  const server = spawn(process.execPath, [path.resolve(__dirname, '../node_modules/vite/bin/vite.js'),
    'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    { cwd: path.resolve(__dirname, '..'), stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '', stopped = false;
  server.stdout.on('data', value => { output = (output + value).slice(-4000); });
  server.stderr.on('data', value => { output = (output + value).slice(-4000); });
  const exited = new Promise(resolve => server.once('exit', resolve));
  async function stop() {
    if (stopped) return;
    stopped = true;
    if (server.exitCode === null && server.signalCode === null) {
      server.kill('SIGTERM'); // Exact child PID, never a port-wide kill.
      await Promise.race([exited, delay(2000)]);
      if (server.exitCode === null && server.signalCode === null) { server.kill('SIGKILL'); await exited; }
    }
    console.log(`Army QA preview stopped (PID ${server.pid})`);
  }
  const interrupt = async () => { await stop(); process.exit(130); };
  process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (server.exitCode !== null || server.signalCode !== null) throw new Error(`Preview failed: ${output}`);
      try { const response = await fetch(endpoint, { signal: AbortSignal.timeout(700) }); ready = response.ok; } catch {}
      if (ready) break;
      await delay(100);
    }
    if (!ready) throw new Error(`Preview did not become ready: ${output}`);
    console.log(`Army QA preview started (PID ${server.pid}, port ${port})`);
    return await run();
  } finally {
    await stop(); process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt);
  }
}
module.exports = { withArmyServer };
