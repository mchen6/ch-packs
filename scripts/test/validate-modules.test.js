'use strict';
// scripts/validate-modules.js: every module directory under a folder through
// countinghouse-validate, exit 1 when any has a problem.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const ROOT = path.join(__dirname, '..', '..');
const SCRIPT = path.join(ROOT, 'scripts', 'validate-modules.js');
const FIXTURES = path.join(__dirname, 'fixtures');

const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], {cwd: ROOT, encoding: 'utf8'});

test('validate-modules exits 1 when a module has a problem', () => {
  const r = run(FIXTURES);
  assert.strictEqual(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /^bad-module: 1 problem\(s\)$/m);
  assert.match(r.stdout, /\[assembleHandlerMap\] .*helloService\.goodbye/);
  assert.match(r.stdout, /^ok: hello-module$/m);
});

test('validate-modules exits 0 when every module is clean', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ch-validate-'));
  try {
    fs.cpSync(path.join(FIXTURES, 'hello-module'), path.join(dir, 'hello-module'), {recursive: true});
    fs.mkdirSync(path.join(dir, 'not-a-module')); // no package.json: not looked at
    const r = run(dir);
    assert.strictEqual(r.status, 0, r.stdout + r.stderr);
    assert.strictEqual(r.stdout, 'ok: hello-module\n1 module(s), no problems\n');
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('validate-modules says so when there is no module to check, exit 0', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ch-validate-'));
  try {
    const r = run(dir);
    assert.strictEqual(r.status, 0, r.stdout + r.stderr);
    assert.strictEqual(r.stdout, `no module found in ${dir}\n`);
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('validate-modules exits 2 on a folder it cannot read', () => {
  const r = run(path.join(FIXTURES, 'no-such-folder'));
  assert.strictEqual(r.status, 2);
  assert.match(r.stderr, /^validate-modules: cannot read .*no-such-folder \(ENOENT\)\n$/);
});
