'use strict';
// The smoke script's own failures, before any server: a clear FAIL line, exit
// 1, and nothing left behind in the temporary directory.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const SCRIPT = path.join(__dirname, '..', 'smoke-runtime.js');
const smokeDirs = () => fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith('ch-smoke-'));

test('a SMOKE_PORT that is not a port fails at once and leaves no temporary directory', () => {
  const before = new Set(smokeDirs());
  const r = spawnSync(process.execPath, [SCRIPT], {encoding: 'utf8', env: {...process.env, SMOKE_PORT: 'abc'}});
  assert.strictEqual(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stderr, /^smoke: FAIL: SMOKE_PORT must be a port number from 1 to 65535, not "abc"\n/);
  assert.deepStrictEqual(smokeDirs().filter((n) => !before.has(n)), []);
});
