'use strict';
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
require('../../../test-support/runtime');
const {normaliseLine, signatureOf} = require('../lib/normalise');
const sign = require('../handlers/signatureService/sign');

const run1 = [
  {text: '✖ adds two numbers (2.1ms)', kind: 'error'},
  {text: '  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: 3 !== 4', kind: 'assert'},
  {text: '      at TestContext.<anonymous> (/home/runner/work/widgets/widgets/test/add.test.js:7:10)', kind: 'stack'},
  {text: '##[error]Process completed with exit code 1.', kind: 'exit'}
];
const run2 = [
  {text: '✖ adds two numbers (14.7ms)', kind: 'error'},
  {text: '  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: 5 !== 6', kind: 'assert'},
  {text: '    at TestContext.<anonymous>   (/Users/runner/work/widgets/widgets/test/add.test.js:9:3)', kind: 'stack'},
  {text: '##[error]Process completed with exit code 2.', kind: 'exit'}
];

test('the same failure with different numbers and paths has one signature', () => {
  assert.strictEqual(signatureOf('Run npm test', run1), signatureOf('Run npm test', run2));
});

test('a different error line changes the signature', () => {
  const other = run1.map((l, i) => (i === 1 ? {...l, text: '  TypeError: Cannot read properties of undefined'} : l));
  assert.notStrictEqual(signatureOf('Run npm test', run1), signatureOf('Run npm test', other));
});

test('the step is part of the signature', () => {
  assert.notStrictEqual(signatureOf('Run npm test', run1), signatureOf('Run npm run lint', run1));
  assert.notStrictEqual(signatureOf(null, run1), signatureOf('Run npm test', run1));
});

test('tail lines do not affect the signature', () => {
  const withTail = [{text: '> widgets@1.0.0 test', kind: 'tail'}, ...run1, {text: 'took 4123 ms, random 9f8e7d', kind: 'tail'}];
  assert.strictEqual(signatureOf('Run npm test', withTail), signatureOf('Run npm test', run1));
});

test('the signature is sha256 of the step and the normalised lines', () => {
  const expected = crypto.createHash('sha256')
    .update(['Run npm test', ...run1.map((l) => normaliseLine(l.text))].join('\n'))
    .digest('hex');
  assert.strictEqual(signatureOf('Run npm test', run1), expected);
});

test('normaliseLine examples', () => {
  const cases = [
    ['2026-11-11T19:00:11.1066192Z boom at 19:00:11', 'T boom at T'],
    ['✖ adds two numbers (2.1ms) after 3s and 2m', '✖ adds two numbers (D) after D and D'],
    ['      at TestContext.<anonymous> (/home/runner/work/widgets/widgets/test/add.test.js:7:10)', 'at TestContext.<anonymous> (P/add.test.js:#:#)'],
    ["  Error: ENOENT: no such file or directory, open 'C:\\a\\widgets\\widgets\\config.json'", "Error: ENOENT: no such file or directory, open 'P/config.json'"],
    ['expected 3 to equal 4.5 at commit 1f2e3d4c5b6a', 'expected # to equal # at commit H'],
    ["error TS2304: Cannot find name 'x' in 12 files", "error TS2304: Cannot find name 'x' in # files"],
    ['message: "a very long quoted message that goes on and on and on" and "short one"', 'message: "…" and "short one"'],
    ['##[error]Process completed with exit code 1.', '##[error]Process completed with exit code #.'],
    ['defaced 0xdeadbeef   value', 'defaced H value'],
    ['see https://github.com/o/r/actions/runs/123', 'see https://github.com/o/r/actions/runs/#']
  ];
  for (const [input, expected] of cases) assert.strictEqual(normaliseLine(input), expected, input);
});

test('handler returns a 64-char hex, the normalised lines and the step', async () => {
  const {output} = await sign({failingStep: 'Run npm test', lines: run1});
  assert.match(output.signature, /^[0-9a-f]{64}$/);
  assert.strictEqual(output.signature, signatureOf('Run npm test', run1));
  assert.deepStrictEqual(output.normalised, run1.map((l) => normaliseLine(l.text)));
  assert.strictEqual(output.step, 'Run npm test');
  // ch-step-error-patterns' output is accepted as it is: step and index ride along.
  const {output: same} = await sign({failingStep: 'Run npm test', lines: run1.map((l, index) => ({...l, step: 'Run npm test', index})), truncated: false});
  assert.strictEqual(same.signature, output.signature);
  assert.strictEqual((await sign({failingStep: null, lines: []})).output.step, null);
});

test('handler refuses what is not error-patterns output', async () => {
  const invalid = (err) => err.code === 'ARGUMENTS_INVALID';
  for (const bad of [{}, {failingStep: 3, lines: []}, {failingStep: null}, {failingStep: null, lines: [{text: 'x'}]}, {failingStep: null, lines: [{text: 'x', kind: 'other'}]}, null]) {
    await assert.rejects(sign(bad), invalid, JSON.stringify(bad));
  }
});

test('the module is a part: never listed', () => {
  assert.deepStrictEqual(require('../package.json').countinghouse, {role: 'part'});
});
