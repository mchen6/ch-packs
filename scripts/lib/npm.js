'use strict';
// Runs npm as `node npm-cli.js …` so no shell is needed on any system: Windows
// refuses to spawn npm.cmd without one, and a shell would reparse arguments.
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

function npmCli() {
  const fromNpm = process.env.npm_execpath;
  if (fromNpm && /npm-cli\.js$/.test(fromNpm) && fs.existsSync(fromNpm)) return fromNpm;
  const bin = path.dirname(process.execPath);
  const candidates = [
    path.join(bin, 'node_modules', 'npm', 'bin', 'npm-cli.js'), // Windows
    path.join(bin, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js') // Linux, macOS
  ];
  const found = candidates.find((c) => fs.existsSync(c));
  if (!found) throw new Error(`cannot find npm beside ${process.execPath}`);
  return found;
}

// -> {status, stdout, stderr}
function npm(args, {cwd}) {
  return spawnSync(process.execPath, [npmCli(), ...args], {cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
}

module.exports = {npm, npmCli};
