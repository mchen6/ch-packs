'use strict';
// Every workspace is named <SCOPE>/<its directory> (Global Constraints: the
// scope is one constant), its directory starts with ch-, every module
// declares its role, and every package carries what npm trusted publishing
// needs: the exact repository URL and public access (docs/publishing.md).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const {SCOPE} = require('../lib/scope');

const ROOT = path.join(__dirname, '..', '..');
const workspaces = ['modules', 'packages'].flatMap((top) =>
  fs.readdirSync(path.join(ROOT, top), {withFileTypes: true})
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(ROOT, top, e.name, 'package.json')))
    .map((e) => ({top, dir: e.name, pkg: JSON.parse(fs.readFileSync(path.join(ROOT, top, e.name, 'package.json'), 'utf8'))})));

test('the scope is one constant, an npm scope (@countinghouse until Matt names it)', () => {
  assert.match(SCOPE, /^@[A-Za-z0-9][A-Za-z0-9-]*$/);
  // The rename is one search-and-replace of the scope, constant included.
  assert.strictEqual(fs.readFileSync(path.join(ROOT, 'scripts', 'lib', 'scope.js'), 'utf8').includes(`SCOPE: '${SCOPE}'`), true);
});

test('every workspace is named <SCOPE>/<its directory>, with the ch- prefix', () => {
  for (const {top, dir, pkg} of workspaces) {
    assert.match(dir, /^ch-[a-z0-9-]+$/, `${top}/${dir}`);
    assert.strictEqual(pkg.name, `${SCOPE}/${dir}`, `${top}/${dir}`);
    assert.strictEqual(pkg.license, 'Apache-2.0', `${top}/${dir}`);
  }
});

test('every workspace names this repository exactly and publishes as public (trusted publishing)', () => {
  for (const {top, dir, pkg} of workspaces) {
    assert.deepStrictEqual(pkg.repository,
      {type: 'git', url: 'https://github.com/mchen6/ch-packs.git', directory: `${top}/${dir}`}, `${top}/${dir}`);
    assert.deepStrictEqual(pkg.publishConfig, {access: 'public'}, `${top}/${dir}`);
    assert.notStrictEqual(pkg.private, true, `${top}/${dir}`);
  }
});

test('every module declares its role, and its friendlyName is the bare ch- name', () => {
  for (const {dir, pkg} of workspaces.filter((w) => w.top === 'modules')) {
    assert.ok(['scenario', 'part'].includes(pkg.countinghouse && pkg.countinghouse.role), dir);
    const api = JSON.parse(fs.readFileSync(path.join(ROOT, 'modules', dir, 'api.json'), 'utf8'));
    assert.strictEqual(api.device.friendlyName, dir);
  }
});
