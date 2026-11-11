'use strict';
// The Claude Code plugin: marketplace at the repo root, the plugin under
// clients/claude-code, its .mcp.json, the skill, and launch.js.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const ROOT = path.join(__dirname, '..', '..', '..');
const PLUGIN = path.join(__dirname, '..', 'clients', 'claude-code');
const json = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const LAUNCH = path.join(PLUGIN, 'bin', 'launch.js');

test('the marketplace lists ch-packs from a relative source that exists', () => {
  const m = json(path.join(ROOT, '.claude-plugin', 'marketplace.json'));
  assert.strictEqual(m.name, 'ch-packs');
  assert.strictEqual(typeof m.owner.name, 'string');
  assert.deepStrictEqual(m.plugins.map((p) => p.name), ['ch-packs']);
  const source = m.plugins[0].source;
  assert.match(source, /^\.\//);
  assert.strictEqual(path.resolve(ROOT, source), PLUGIN);
  assert.strictEqual(json(path.join(PLUGIN, '.claude-plugin', 'plugin.json')).name, 'ch-packs');
});

test('the plugin\'s .mcp.json runs launch.js with node and names the credentials only', () => {
  const entry = json(path.join(PLUGIN, '.mcp.json')).mcpServers['ci-failure-triage'];
  assert.deepStrictEqual(entry, {
    command: 'node',
    args: ['${CLAUDE_PLUGIN_ROOT}/bin/launch.js', 'start', '--pack', 'ci-failure-triage', '--stdio'],
    env: {COUNTINGHOUSE_GITHUB_TOKEN: '${COUNTINGHOUSE_GITHUB_TOKEN:-}', GITHUB_TOKEN: '${GITHUB_TOKEN:-}'}
  });
});

test('the skill carries the plan\'s sentence verbatim', () => {
  const skill = fs.readFileSync(path.join(PLUGIN, 'skills', 'ci-failure-triage', 'SKILL.md'), 'utf8');
  assert.match(skill, /^---\nname: ci-failure-triage\ndescription: .+\n---\n/);
  assert.ok(skill.includes('when a CI run failed, call `ci_failure_triage` first and show its receipt line verbatim'));
});

test('launch.js without an installed launcher exits non-zero with one line naming the install command', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ch-launch-'));
  try {
    const r = spawnSync(process.execPath, [LAUNCH, 'start', '--pack', 'ci-failure-triage', '--stdio'], {encoding: 'utf8', env: {...process.env, COUNTINGHOUSE_HOME: home}});
    assert.strictEqual(r.status, 1);
    assert.strictEqual(r.stdout, '', 'stdout is the MCP channel: nothing on it');
    assert.strictEqual(r.stderr.trim().split('\n').length, 1);
    assert.match(r.stderr, /npx @SCOPE\/ch-local install --pack ci-failure-triage/);
  } finally {
    fs.rmSync(home, {recursive: true, force: true});
  }
});

test('launch.js hands its arguments, stdio and exit code to the installed launcher', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ch-launch-'));
  try {
    fs.mkdirSync(path.join(home, 'bin'));
    fs.writeFileSync(path.join(home, 'bin', 'ch-local.js'), "process.stdin.once('data', (d) => { process.stdout.write(JSON.stringify(process.argv.slice(2)) + ' ' + d); process.exit(7); });\n");
    const r = spawnSync(process.execPath, [LAUNCH, 'start', '--pack', 'ci-failure-triage', '--stdio'], {encoding: 'utf8', input: 'ping', env: {...process.env, COUNTINGHOUSE_HOME: home}});
    assert.strictEqual(r.status, 7, r.stderr);
    assert.strictEqual(r.stdout, '["start","--pack","ci-failure-triage","--stdio"] ping');
  } finally {
    fs.rmSync(home, {recursive: true, force: true});
  }
});

test('launch.js fetches nothing', () => {
  const src = fs.readFileSync(LAUNCH, 'utf8');
  for (const word of ['fetch', 'http', 'https', 'net', 'dns', 'npx']) {
    assert.ok(!new RegExp(`require\\(['"](node:)?${word}['"]\\)|\\b${word}\\(`).test(src), word);
  }
});
