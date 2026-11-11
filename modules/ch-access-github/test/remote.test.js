'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const {TOOLS} = require('../lib/remote');

const ROOT = path.join(__dirname, '..');
const handlers = fs.readdirSync(path.join(ROOT, 'handlers', 'githubService')).map((f) => path.join(ROOT, 'handlers', 'githubService', f));
const NAMES = ['actions_list', 'actions_get', 'get_job_logs', 'list_commits', 'get_commit', 'list_workflow_runs', 'list_workflow_jobs', 'remote:github'];

test('a tool rename is one table entry: no handler names a tool', () => {
  for (const file of handlers) {
    const src = fs.readFileSync(file, 'utf8');
    for (const name of NAMES) assert.ok(!src.includes(name), `${path.basename(file)} names ${name}`);
  }
  for (const file of fs.readdirSync(path.join(ROOT, 'lib')).filter((f) => f !== 'remote.js')) {
    const src = fs.readFileSync(path.join(ROOT, 'lib', file), 'utf8');
    for (const name of NAMES) assert.ok(!src.includes(name), `lib/${file} names ${name}`);
  }
});

test('every tool in the table is one the recorded server offers', () => {
  const offered = new Set(require('./fixtures/mcp-results/tools-list.json').tools.map((t) => t.name));
  for (const [action, {tool}] of Object.entries(TOOLS)) assert.ok(offered.has(tool), `${action} -> ${tool}`);
});

test('the package declares the GitHub remote exactly as the plan writes it', () => {
  assert.deepStrictEqual(require('../package.json').countinghouse, {
    role: 'part',
    remotes: [{name: 'github', transport: 'streamable-http', url: 'https://api.githubcopilot.com/mcp/', credential: {env: 'COUNTINGHOUSE_GITHUB_TOKEN', fallbackEnv: 'GITHUB_TOKEN', header: 'Authorization', scheme: 'Bearer'}}]
  });
});
