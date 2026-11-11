'use strict';
// The publish script decides from the registry alone: a version already on
// npm is skipped, a new version of a known package is published, a package npm
// has never seen is reported (its first version is published by hand), and a
// private workspace is never considered. The npm floor is the one trusted
// publishing documents.
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const {workspaces, registryState, plan, npmIsRecentEnough, MIN_NPM} = require('../publish-changed');

const fakeView = (known) => (name) => {
  if (!(name in known)) return {status: 404};
  return {status: 0, versions: known[name]};
};

test('registryState: published, new and absent', () => {
  const view = fakeView({'@countinghouse/ch-step-redact': ['0.1.0', '0.2.0']});
  assert.strictEqual(registryState('@countinghouse/ch-step-redact', '0.2.0', view), 'published');
  assert.strictEqual(registryState('@countinghouse/ch-step-redact', '0.3.0', view), 'new');
  assert.strictEqual(registryState('@countinghouse/ch-local', '0.1.0', view), 'absent');
});

test('registryState: any other npm failure is an error, never a publish', () => {
  assert.throws(() => registryState('x', '1.0.0', () => ({status: 1, stderr: 'E429 too many requests'})), /E429/);
});

test('plan: private workspaces are left out, the rest carry their state', () => {
  const list = [
    {dir: 'modules/ch-step-redact', pkg: {name: '@countinghouse/ch-step-redact', version: '0.2.0'}},
    {dir: 'packages/ch-local', pkg: {name: '@countinghouse/ch-local', version: '0.1.0'}},
    {dir: 'packages/internal', pkg: {name: '@countinghouse/internal', version: '0.0.1', private: true}}
  ];
  const view = fakeView({'@countinghouse/ch-step-redact': ['0.1.0']});
  assert.deepStrictEqual(plan(list, view), [
    {dir: 'modules/ch-step-redact', name: '@countinghouse/ch-step-redact', version: '0.2.0', state: 'new'},
    {dir: 'packages/ch-local', name: '@countinghouse/ch-local', version: '0.1.0', state: 'absent'}
  ]);
});

test('workspaces: every directory of this repository with a package.json, none private', () => {
  const found = workspaces(path.join(__dirname, '..', '..'));
  assert.ok(found.length >= 8);
  for (const w of found) {
    assert.match(w.dir, /^(modules|packages)\/ch-[a-z0-9-]+$/);
    assert.match(w.pkg.name, /^@countinghouse\/ch-[a-z0-9-]+$/);
    assert.notStrictEqual(w.pkg.private, true);
  }
});

test('npm floor is 11.5.1 (trusted publishing)', () => {
  assert.deepStrictEqual(MIN_NPM, [11, 5, 1]);
  assert.strictEqual(npmIsRecentEnough('11.5.1'), true);
  assert.strictEqual(npmIsRecentEnough('11.19.0\n'), true);
  assert.strictEqual(npmIsRecentEnough('12.0.0'), true);
  assert.strictEqual(npmIsRecentEnough('11.5.0'), false);
  assert.strictEqual(npmIsRecentEnough('10.9.4'), false);
});
