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
const ls = spawnSync('git', ['ls-files'], {cwd: ROOT, encoding: 'utf8'});
if (ls.error || ls.status !== 0) throw new Error(`these tests read a git checkout: git ls-files failed (${ls.error ? ls.error.code : ls.stderr.trim()})`);
const tracked = ls.stdout.split('\n').filter(Boolean);
// From /code-review medium on #37: an empty list would pass every "not tracked" check.
if (!tracked.includes('package.json')) throw new Error('git ls-files listed no package.json: not this repository');

const REPOS = ['ch-local', 'ch-access-github', 'ch-pack-ci-failure-triage', 'ch-report',
  'ch-step-redact', 'ch-step-log-clean', 'ch-step-error-patterns', 'ch-step-failure-signature',
  'ch-step-dedupe', 'ch-step-owner-hint', 'ch-step-report'];

test('no package lives here any more', () => {
  for (const dir of ['modules/', 'packages/', 'test-support/', 'scripts/lib/']) {
    assert.deepStrictEqual(tracked.filter((f) => f.startsWith(dir)), [], dir);
  }
  for (const file of ['.github/workflows/publish.yml', 'scripts/pack-all.js',
    'scripts/validate-modules.js', 'scripts/publish-changed.js', 'scripts/test-usage-fixture.js', 'scripts/smoke-runtime.js']) {
    assert.ok(!tracked.includes(file), file);
  }
});

// Task 13 adds what its acceptance script needs; a family package never comes
// back as a dependency: the acceptance installs them from their own tarballs.
test('the root package.json is private, with no workspaces and no family package as a dependency', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.strictEqual(pkg.private, true);
  assert.ok(!('workspaces' in pkg), 'workspaces');
  for (const key of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    for (const name of Object.keys(pkg[key] || {})) assert.ok(!name.startsWith('@countinghouse/ch-'), `${key}: ${name}`);
  }
});

test('the README says where each package lives', () => {
  const readme = read('README.md');
  for (const name of REPOS) assert.ok(readme.includes(`https://github.com/mchen6/${name}`), name);
});

test('nothing is published from here: publishing.md points at the package repositories', () => {
  const doc = read('docs/publishing.md');
  assert.match(doc, /Nothing is published from ch-packs/);
  const paragraphs = doc.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p !== '' && !p.startsWith('#'));
  assert.strictEqual(paragraphs.length, 1, 'one paragraph');
  for (const name of REPOS) assert.ok(doc.includes(name) || (name.startsWith('ch-step-') && doc.includes('ch-step-*')), name);
  assert.ok(!/before Matt says so|January 2027/.test(doc), 'the spec: each package is published as soon as it is ready');
});

test('the plan reads the per-repository layout', () => {
  const plan = read('docs/superpowers/plans/2026-11-11-ch-packs-v1.md');
  assert.ok(plan.includes('"url": "https://api.githubcopilot.com/mcp/", "headers": {"X-MCP-Toolsets": "actions,repos"}, "credential":'), 'Task 8 declares the header');
  const task = (n) => plan.slice(plan.indexOf(`### Task ${n}:`), plan.indexOf(`### Task ${n + 1}:`));
  for (const n of [11, 12]) assert.match(task(n), /mchen6\/ch-local/, `Task ${n}`);
  assert.match(task(13), /sibling repositories/);
  assert.match(task(13), /ACCEPTANCE_REPOS_TOKEN/, 'Task 13 says how it reads private sibling repositories');
  // From /code-review medium on #37: the plan no longer names monorepo files as current.
  assert.ok(!plan.includes('in code as one constant, `scripts/lib/scope.js`'), 'Global Constraints: the scope constant');
  assert.ok(!plan.includes('`scripts/test-usage-fixture.js` (root)'), 'Task 10');
  assert.ok(!plan.includes('**Architecture:** One repository, npm workspaces'), 'Architecture');
  const rc1 = plan.split('\n').find((l) => l.startsWith('- RC1-min (A):'));
  assert.match(rc1, /headers: \{/, 'the plan\'s RC1-min remote shape has headers');
  assert.match(rc1, /fallbackEnv/, 'and fallbackEnv');
  assert.ok(!task(13).includes('`npm run pack` (Task 1)'), 'Task 13 no longer packs a monorepo');
});

test('.gitignore keeps tarballs and npm logs out, and names no fixture this repository does not have', () => {
  const ignored = (p) => spawnSync('git', ['check-ignore', '-q', p], {cwd: ROOT}).status === 0;
  assert.strictEqual(ignored('dist/x.tgz'), true);
  assert.strictEqual(ignored('npm-debug.log'), true);
  assert.ok(!/fixtures/.test(read('.gitignore')), '.gitignore');
  assert.ok(!/fixture/.test(read('.gitattributes')), '.gitattributes');
});

test('the spec says where a package is published from', () => {
  const spec = read('docs/superpowers/specs/2026-11-11-client-packs-design.md');
  assert.ok(!spec.includes('`.github/workflows/publish.yml` (no token, no 2FA code; docs/publishing.md)'), 'spec decision 8');
});

// Matt and the reviewer, 2026-11-11: the usage report is the runtime's tool, ch-report is retired.
test('the usage report is the runtime\'s countinghouse_usage_report, and ch-report is retired', () => {
  const plan = read('docs/superpowers/plans/2026-11-11-ch-packs-v1.md');
  // Task 10 stays as the record of what was built; everywhere else the tool is the runtime's.
  const [t10, t11] = [plan.indexOf('### Task 10:'), plan.indexOf('### Task 11:')];
  assert.ok(t10 > 0 && t11 > t10, 'Task 10 and Task 11 headings found');
  const live = plan.slice(0, t10) + plan.slice(t11);
  assert.ok(!/[^_]`usage_report`/.test(live), 'no bare usage_report tool left outside the retired Task 10');
  assert.ok(!plan.includes('ch-report --json'), 'Task 13 runs no ch-report');
  assert.ok(!plan.includes('uninstall --yes'), 'uninstall has no --yes; it asks on stdin');
  assert.match(plan, /### Task 10: `ch-report` layer 1 \(retired\)/);
  const rc1 = plan.split('\n').find((l) => l.startsWith('- RC1-min (A):'));
  assert.match(rc1, /raw MCP `CallToolResult`/);
  const row = read('README.md').split('\n').find((l) => l.startsWith('| `ch-report`'));
  assert.match(row, /retired; code moves into countinghouse `lib\/usage\/`/);
});

// From /code-review medium on #38: the decisions reach every line, spec included.
test('no plan or spec line still describes a retired report or the old launcher', () => {
  const plan = read('docs/superpowers/plans/2026-11-11-ch-packs-v1.md');
  const spec = read('docs/superpowers/specs/2026-11-11-client-packs-design.md');
  const [t10, t11] = [plan.indexOf('### Task 10:'), plan.indexOf('### Task 11:')];
  const live = plan.slice(0, t10) + plan.slice(t11);
  for (const [where, text] of [['plan', live], ['spec', spec]]) {
    assert.ok(!text.includes('ch-local report'), `${where}: ch-local report`);
    assert.ok(!/bin\/ch-local start|bin\/ch-local\)/.test(text), `${where}: the extensionless launcher`);
    assert.ok(!text.includes('npx ch-local --pack'), `${where}: the unpinned npx form`);
  }
  assert.ok(!live.includes('generated package.json + lockfile'), 'Task 11: install writes the pinned lockfile');
  assert.ok(!live.includes('exactly two tools'), 'Task 13: the pack\'s tool and the runtime\'s, not a count of every built-in');
  for (const line of spec.split('\n').filter((l) => l.includes('ch-report'))) assert.match(line, /retired/, line);
  const constraint = plan.split('\n').find((l) => l.startsWith('- The report'));
  assert.match(constraint, /countinghouse_usage_report/);
});

test('the repository comes from DeviceConfig.defaultRepo, written by start (reviewer, 2026-11-11)', () => {
  const plan = read('docs/superpowers/plans/2026-11-11-ch-packs-v1.md');
  const task = (n) => plan.slice(plan.indexOf(`### Task ${n}:`), plan.indexOf(`### Task ${n + 1}:`));
  assert.match(task(9), /DeviceConfig\.defaultRepo/);
  assert.match(task(9), /REPO_REQUIRED/);
  assert.ok(!task(9).includes('COUNTINGHOUSE_CWD'), 'no invented interface');
  assert.match(task(11), /--deviceConfigPath <home>\/config\/<pid>/);
});
