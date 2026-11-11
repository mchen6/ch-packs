'use strict';
const test = require('node:test');
const assert = require('node:assert');
require('../../../test-support/runtime');
const {extractErrors} = require('../lib/patterns');
const extract = require('../handlers/patternService/extract');
const nodeTest = require('./fixtures/steps-node-test.json');
const python = require('./fixtures/steps-python.json');

const L = (step, index, kind) => ({step, index, kind});
const shape = (out) => out.lines.map(({step, index, kind}) => ({step, index, kind}));

test('finds the failing step and its error lines', () => {
  // ch-step-log-clean's output for its ubuntu fixture: a node --test failure.
  const out = extractErrors(nodeTest.steps, 40);
  assert.strictEqual(out.failingStep, 'Run npm test');
  assert.strictEqual(out.truncated, false);
  const S = 'Run npm test';
  // Four lines match, under five, so the failing step's tail fills in the rest.
  assert.deepStrictEqual(shape(out), [
    L(S, 0, 'tail'), L(S, 1, 'tail'), L(S, 2, 'tail'), L(S, 3, 'tail'),
    L(S, 4, 'error'), L(S, 5, 'assert'), L(S, 6, 'tail'), L(S, 7, 'stack'), L(S, 8, 'exit')
  ]);
  assert.strictEqual(out.lines[8].text, '##[error]Process completed with exit code 1.');
  assert.strictEqual(out.lines[5].text, '  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:');
});

test('a Python traceback: its head and first two frames, the assertion, the exit; an error in a post step is listed but is not the failing step', () => {
  const out = extractErrors(python.steps, 40);
  assert.strictEqual(out.failingStep, 'Run pytest -q');
  const S = 'Run pytest -q';
  assert.deepStrictEqual(shape(out), [
    L(S, 5, 'stack'), L(S, 6, 'stack'), L(S, 8, 'stack'), L(S, 10, 'assert'), L(S, 11, 'assert'), L(S, 13, 'exit'),
    L('Post job cleanup', 0, 'error')
  ]);
});

test('runner and tool patterns', () => {
  const kinds = (line) => extractErrors([{name: 'Run x', lines: [line]}], 40).lines.filter((l) => l.kind !== 'tail').map((l) => l.kind);
  const cases = [
    ['TypeError: Cannot read properties of undefined', ['error']],
    ['Error: ENOENT: no such file or directory', ['error']],
    ['java.lang.IllegalStateException: closed', ['error']],
    ['npm error code 1', ['error']],
    ['src/a.ts(3,1): error TS2304: Cannot find name', ['error']],
    ['panic: runtime error: index out of range', ['error']],
    ['fatal: not a git repository', ['error']],
    ['--- FAIL: TestParse (0.00s)', ['error']],
    ['FAILED tests/test_a.py::test_a', ['error']],
    ['not ok 3 - parses', ['error']],
    ['✖ parses (1.2ms)', ['error']],
    ['expected 3 to equal 4 but FAILED', ['assert']],
    ['##[error]Something went wrong', ['error']],
    ['##[error]Process completed with exit code 2.', ['exit']],
    ['Process completed with exit code 0.', []],
    ['0 errors, 0 warnings', []],
    ['=== FAILURES ===', []],
    ['ErrorBoundary rendered', []]
  ];
  for (const [line, expected] of cases) assert.deepStrictEqual(kinds(line), expected, line);
});

test('only the first two stack frames after an error are taken', () => {
  const lines = ['Error: boom', '    at a (a.js:1:1)', '    at b (b.js:1:1)', '    at c (c.js:1:1)', 'next', 'x', 'y', 'z'];
  const out = extractErrors([{name: 'Run x', lines}], 40);
  assert.deepStrictEqual(out.lines.filter((l) => l.kind === 'stack').map((l) => l.index), [1, 2]);
});

test('with no exit line the failing step is the last step with an error line', () => {
  const steps = [{name: 'Run a', lines: ['Error: one']}, {name: 'Run b', lines: ['Error: two']}, {name: 'Run c', lines: ['fine']}];
  assert.strictEqual(extractErrors(steps, 40).failingStep, 'Run b');
});

test('falls back to the tail when nothing matches', () => {
  const lines = Array.from({length: 20}, (_, i) => `line ${i}`);
  const out = extractErrors([{name: '(top)', lines: ['set up']}, {name: 'Run make', lines}, {name: 'Post job cleanup', lines: ['bye']}], 40);
  assert.strictEqual(out.failingStep, null);
  assert.deepStrictEqual(out.lines.map((l) => [l.step, l.index, l.kind]), lines.slice(5).map((_, i) => ['Run make', i + 5, 'tail']));
  assert.deepStrictEqual(extractErrors([], 40), {failingStep: null, lines: [], truncated: false});
});

test('caps at maxLines and sets truncated, keeping the failing step\'s exit and first errors', () => {
  const lines = [...Array.from({length: 100}, (_, i) => `Error: number ${i}`), '##[error]Process completed with exit code 1.'];
  const out = extractErrors([{name: 'Run noisy', lines: ['Error: elsewhere']}, {name: 'Run x', lines}], 10);
  assert.strictEqual(out.truncated, true);
  assert.strictEqual(out.lines.length, 10);
  assert.deepStrictEqual(out.lines.map((l) => l.index), [0, 1, 2, 3, 4, 5, 6, 7, 8, 100]);
  assert.ok(out.lines.every((l) => l.step === 'Run x'));
  assert.strictEqual(out.lines[9].kind, 'exit');
});

test('handler validates maxLines range', async () => {
  const invalid = (err) => err.code === 'ARGUMENTS_INVALID';
  for (const maxLines of [0, 201, 1.5, '10']) {
    await assert.rejects(extract({steps: [], maxLines}), invalid, String(maxLines));
  }
  for (const bad of [{}, {steps: 'x'}, {steps: [{name: 'a'}]}, {steps: [{name: 1, lines: []}]}, {steps: [{name: 'a', lines: [1]}]}, null]) {
    await assert.rejects(extract(bad), invalid, JSON.stringify(bad));
  }
  const {output} = await extract({steps: nodeTest.steps});
  assert.deepStrictEqual(output, extractErrors(nodeTest.steps, 40));
  assert.strictEqual((await extract({steps: nodeTest.steps, maxLines: 200})).output.lines.length, 9);
});

test('the module is a part: never listed', () => {
  assert.deepStrictEqual(require('../package.json').countinghouse, {role: 'part'});
});
