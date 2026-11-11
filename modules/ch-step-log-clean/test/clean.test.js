'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
require('../../../test-support/runtime');
const {cleanLog} = require('../lib/clean');
const clean = require('../handlers/cleanService/clean');

const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

// The fixtures follow a real job log's layout (checked against this
// repository's own CI log, 2026-11-11): a BOM, a timestamp on every line, a
// step's `##[group]Run …` header holding only the command, the step's output
// after `##[endgroup]`, sub-groups inside a step, post steps opened by a plain
// "Post job cleanup." line.
test('groups lines into steps and strips timestamps and ansi', () => {
  const out = cleanLog(fixture('ubuntu.log'));
  assert.deepStrictEqual(out, {
    steps: [
      {name: '(top)', lines: ["Current runner version: '2.338.2'", 'Image: ubuntu-24.04', 'Complete job name: test (ubuntu-latest, 24)']},
      {name: 'Run actions/checkout@v4', lines: [
        'with:',
        '  repository: example/widgets',
        'Syncing repository: example/widgets',
        '[command]/usr/bin/git -c protocol.version=2 fetch --no-tags --prune --depth=1 origin'
      ]},
      {name: 'Run npm test', lines: [
        'npm test',
        'shell: /usr/bin/bash -e {0}',
        '> widgets@1.0.0 test',
        '> node --test',
        '✖ adds two numbers (2.1ms)',
        '  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:',
        '  3 !== 4',
        '      at TestContext.<anonymous> (/home/runner/work/widgets/widgets/test/add.test.js:7:10)',
        '##[error]Process completed with exit code 1.'
      ]},
      {name: 'Post job cleanup', lines: ['[command]/usr/bin/git version', 'git version 2.56.0', 'Cleaning up orphan processes']}
    ],
    totalLines: 35,
    kept: 19
  });
});

test('cleans CRLF and BOM logs', () => { // Review Focus 1
  const out = cleanLog(fixture('windows-crlf-bom.log'));
  assert.strictEqual(out.steps[0].name, '(top)');
  assert.ok(out.steps.some((s) => s.name === 'Run tests'));
  assert.ok(out.steps.flatMap((s) => s.lines).every((l) => !l.includes('\r') && !l.includes('\ufeff')));
  assert.deepStrictEqual(out.steps.map((s) => s.name), ['(top)', 'Run tests']);
  assert.deepStrictEqual(out.steps[1].lines, [
    'npm test',
    "shell: C:\\Program Files\\PowerShell\\7\\pwsh.EXE -command \". '{0}'\"",
    'Downloading 100%', // a carriage-return progress line keeps what a terminal shows last
    'not ok 1 - reads the config',
    "  Error: ENOENT: no such file or directory, open 'C:\\a\\widgets\\widgets\\config.json'",
    '##[error]Process completed with exit code 1.'
  ]);
  assert.strictEqual(out.totalLines, 10);
});

test('progress lines are dropped and counted', () => {
  const out = cleanLog([' 45%', '12.5% done', '  |', '/', '\\', '-', 'Receiving objects:  3% (1/30)', 'Resolving deltas: 100% (2/2)', 'real line', '', '   ', '2026-11-11T19:00:11.1066192Z'].join('\n'));
  assert.deepStrictEqual(out, {steps: [{name: '(top)', lines: ['real line']}], totalLines: 12, kept: 1});
});

test('a sub-group inside a step stays in the step; its markers go', () => {
  const out = cleanLog(['##[group]Run make', 'make', '##[endgroup]', '##[group]Compiling', 'cc -c a.c', '##[endgroup]', 'done'].join('\n'));
  assert.deepStrictEqual(out.steps, [{name: 'Run make', lines: ['make', 'cc -c a.c', 'done']}]);
});

test('a step with no output is still a step; an empty (top) is left out', () => {
  const out = cleanLog(['##[group]Run true', '##[endgroup]', '##[group]Run false', '##[endgroup]', '##[error]Process completed with exit code 1.'].join('\n'));
  assert.deepStrictEqual(out.steps, [{name: 'Run true', lines: []}, {name: 'Run false', lines: ['##[error]Process completed with exit code 1.']}]);
});

test('an empty log has no steps', () => {
  assert.deepStrictEqual(cleanLog(''), {steps: [], totalLines: 0, kept: 0});
  assert.deepStrictEqual(cleanLog('\ufeff'), {steps: [], totalLines: 0, kept: 0});
});

test('warning and error markers are kept, other ansi forms are stripped', () => {
  const out = cleanLog(['\x1b[1m\x1b[31m##[warning]disk almost full\x1b[0m', '##[error]boom', 'x\x1b[2Ky'].join('\n'));
  assert.deepStrictEqual(out.steps[0].lines, ['##[warning]disk almost full', '##[error]boom', 'xy']);
});

test('a 5 MB log is cleaned in well under a second', () => {
  const line = '2026-11-11T19:00:11.1066192Z \x1b[36mmodule ok\x1b[0m: something happened at step 42 with value 0x1f2e3d';
  const text = ['##[group]Run npm test', '##[endgroup]', ...Array(60000).fill(line)].join('\n');
  assert.ok(text.length > 5e6);
  const start = Date.now();
  const out = cleanLog(text);
  const ms = Date.now() - start;
  assert.strictEqual(out.kept, 60000);
  assert.ok(ms < 1000, `took ${ms} ms`);
});

test('handler wraps cleanLog and refuses a non-string', async () => {
  const {output} = await clean({text: fixture('ubuntu.log')});
  assert.deepStrictEqual(output, cleanLog(fixture('ubuntu.log')));
  for (const bad of [{}, {text: 7}, {text: ['a']}, null]) {
    await assert.rejects(clean(bad), (err) => err.code === 'ARGUMENTS_INVALID', JSON.stringify(bad));
  }
});

test('the module is a part: never listed', () => {
  assert.deepStrictEqual(require('../package.json').countinghouse, {role: 'part'});
});
