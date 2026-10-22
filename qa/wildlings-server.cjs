/* Domain adapter; shares the bounded preview lifetime. */
const { withServer } = require('./server.cjs');
module.exports = { withWildlingServer: withServer };
