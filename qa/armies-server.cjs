/* Backward-compatible domain adapter; one shared preview owner. */
const { withServer, base } = require('./server.cjs');
async function withArmyServer(url, run) {
  if (url !== base) throw new Error('Use QA_PORT to configure the owned local preview');
  return withServer(run);
}
module.exports = { withArmyServer };
