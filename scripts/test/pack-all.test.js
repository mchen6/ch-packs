'use strict';
// scripts/pack-all.js: every workspace packed into dist/, one JSON entry each
// with the tarball's own sha512 integrity.
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const SCRIPT = path.join(__dirname, '..', 'pack-all.js');

function fixtureRoot(packages) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ch-pack-'));
  const write = (file, obj) => {
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n');
  };
  write(path.join(root, 'package.json'), {name: 'fixture-root', version: '0.0.0', private: true, workspaces: ['modules/*', 'packages/*']});
  for (const [dir, name, version] of packages) {
    write(path.join(root, dir, 'package.json'), {name, version, license: 'Apache-2.0'});
    fs.writeFileSync(path.join(root, dir, 'index.js'), `module.exports = '${name}';\n`);
  }
  return root;
}

const run = (root) => spawnSync(process.execPath, [SCRIPT, '--root', root], {encoding: 'utf8'});

test('pack-all prints one entry per workspace with an integrity hash', () => {
  const root = fixtureRoot([['modules/ch-step-a', '@scope/ch-step-a', '1.2.3'], ['packages/ch-b', 'ch-b', '0.1.0']]);
  try {
    const r = run(root);
    assert.strictEqual(r.status, 0, r.stderr);
    const list = JSON.parse(r.stdout);
    assert.deepStrictEqual(list.map((e) => [e.name, e.version]), [['@scope/ch-step-a', '1.2.3'], ['ch-b', '0.1.0']]);
    for (const e of list) {
      assert.deepStrictEqual(Object.keys(e), ['name', 'version', 'file', 'integrity']);
      assert.strictEqual(path.basename(e.file), e.file, 'file is the tarball name inside dist/');
      const bytes = fs.readFileSync(path.join(root, 'dist', e.file));
      assert.match(e.integrity, /^sha512-[A-Za-z0-9+/]+={0,2}$/);
      assert.strictEqual(e.integrity, 'sha512-' + crypto.createHash('sha512').update(bytes).digest('base64'));
    }
    assert.deepStrictEqual(list.map((e) => e.file), ['scope-ch-step-a-1.2.3.tgz', 'ch-b-0.1.0.tgz']);
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
});

test('pack-all prints [] when there is no workspace yet', () => {
  const root = fixtureRoot([]);
  try {
    const r = run(root);
    assert.strictEqual(r.status, 0, r.stderr);
    assert.deepStrictEqual(JSON.parse(r.stdout), []);
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
});

test('a workspace script printing to stdout does not break the JSON', () => {
  const root = fixtureRoot([['packages/ch-b', 'ch-b', '0.1.0']]);
  try {
    const pkgFile = path.join(root, 'packages', 'ch-b', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
    pkg.scripts = {prepack: 'node -e "console.log(\'[noise] from prepack\')"'};
    fs.writeFileSync(pkgFile, JSON.stringify(pkg));
    const r = run(root);
    assert.strictEqual(r.status, 0, r.stderr);
    assert.deepStrictEqual(JSON.parse(r.stdout).map((e) => e.name), ['ch-b']);
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
});

test('an option without its value is refused', () => {
  const r = spawnSync(process.execPath, [SCRIPT, '--out'], {encoding: 'utf8'});
  assert.strictEqual(r.status, 1);
  assert.strictEqual(r.stderr, 'pack-all: --out needs a value\n');
});
