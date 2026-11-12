'use strict';
// ch-packs is the family repository (Matt, 2026-11-11): the design, the plan
// and cross-package acceptance, and no package of its own. Each package lives
// in its own repository under mchen6.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const ROOT = path.join(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const tracked = spawnSync('git', ['ls-files'], {cwd: ROOT, encoding: 'utf8'}).stdout.split('\n').filter(Boolean);

const REPOS = ['ch-local', 'ch-access-github', 'ch-pack-ci-failure-triage', 'ch-report',
  'ch-step-redact', 'ch-step-log-clean', 'ch-step-error-patterns', 'ch-step-failure-signature',
  'ch-step-dedupe', 'ch-step-owner-hint', 'ch-step-report'];

test('no package lives here any more', () => {
  for (const dir of ['modules/', 'packages/', 'test-support/', 'dist/']) {
    assert.deepStrictEqual(tracked.filter((f) => f.startsWith(dir)), [], dir);
  }
  for (const file of ['package-lock.json', '.github/workflows/publish.yml', 'scripts/lib/scope.js', 'scripts/pack-all.js',
    'scripts/validate-modules.js', 'scripts/publish-changed.js', 'scripts/test-usage-fixture.js', 'scripts/smoke-runtime.js']) {
    assert.ok(!tracked.includes(file), file);
  }
});

test('the root package.json is private, with no workspaces and no dependencies', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.strictEqual(pkg.private, true);
  for (const key of ['workspaces', 'dependencies', 'devDependencies', 'allowScripts']) assert.ok(!(key in pkg), key);
});

test('the README says where each package lives', () => {
  const readme = read('README.md');
  for (const name of REPOS) assert.ok(readme.includes(`https://github.com/mchen6/${name}`), name);
});

test('nothing is published from here: publishing.md points at the package repositories', () => {
  const doc = read('docs/publishing.md');
  assert.match(doc, /Nothing is published from ch-packs/);
  assert.ok(doc.split(/\n\s*\n/).filter((p) => !p.startsWith('#')).length === 1, 'one paragraph');
  assert.match(doc, /README/);
});

test('the plan reads the per-repository layout', () => {
  const plan = read('docs/superpowers/plans/2026-11-11-ch-packs-v1.md');
  assert.ok(plan.includes('"url": "https://api.githubcopilot.com/mcp/", "headers": {"X-MCP-Toolsets": "actions,repos"}, "credential":'), 'Task 8 declares the header');
  const task = (n) => plan.slice(plan.indexOf(`### Task ${n}:`), plan.indexOf(`### Task ${n + 1}:`));
  for (const n of [11, 12]) assert.match(task(n), /mchen6\/ch-local/, `Task ${n}`);
  assert.match(task(13), /sibling repositories/);
  assert.ok(!task(13).includes('`npm run pack` (Task 1)'), 'Task 13 no longer packs a monorepo');
});
