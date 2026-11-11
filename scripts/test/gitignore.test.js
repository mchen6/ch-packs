'use strict';
// .gitignore keeps npm's debug logs out but never a log fixture: those are kept
// byte for byte (.gitattributes) and must be committed.
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const ROOT = path.join(__dirname, '..', '..');
const ignored = (p) => spawnSync('git', ['check-ignore', '-q', p], {cwd: ROOT}).status === 0;

test('a log fixture is not ignored; a stray log is', () => {
  assert.strictEqual(ignored('modules/ch-step-x/test/fixtures/ubuntu.log'), false);
  assert.strictEqual(ignored('packages/ch-x/test/fixtures/deep/a.log'), false);
  assert.strictEqual(ignored('npm-debug.log'), true);
  assert.strictEqual(ignored('dist/x.tgz'), true);
});
