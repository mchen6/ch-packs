'use strict';
// The launcher's home: $COUNTINGHOUSE_HOME, else ~/.countinghouse.
const os = require('node:os');
const path = require('node:path');

function home(env = process.env) {
  const set = env.COUNTINGHOUSE_HOME;
  return typeof set === 'string' && set !== '' ? path.resolve(set) : path.join(os.homedir(), '.countinghouse');
}

// The installed launcher a client runs (reviewer, 2026-11-11: a .js file run
// by node, because Windows cannot execute an extensionless file).
const launcherPath = (env = process.env) => path.join(home(env), 'bin', 'ch-local.js');

module.exports = {home, launcherPath};
