#!/usr/bin/env node
'use strict';
// The plugin's entry: runs the installed launcher, <home>/bin/ch-local.js, with
// this process's arguments, stdio and exit code. It fetches and installs nothing.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const set = process.env.COUNTINGHOUSE_HOME;
const home = typeof set === 'string' && set !== '' ? path.resolve(set) : path.join(os.homedir(), '.countinghouse');
const launcher = path.join(home, 'bin', 'ch-local.js');

if (!fs.existsSync(launcher)) {
  process.stderr.write(`ch-packs: the launcher is not installed at ${launcher}; install it with: npx @SCOPE/ch-local install --pack ci-failure-triage\n`);
  process.exit(1);
}
const r = spawnSync(process.execPath, [launcher, ...process.argv.slice(2)], {stdio: 'inherit'});
process.exit(r.status != null ? r.status : 1);
