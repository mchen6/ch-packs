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
    L(S, 0, 'tail'), L(S, 1, 'tail'), L(S, 2, 'tail'),
    L(S, 3, 'error'), L(S, 4, 'assert'), L(S, 5, 'tail'), L(S, 6, 'stack'), L(S, 7, 'exit')
  ]);
  assert.strictEqual(out.lines[7].text, '##[error]Process completed with exit code 1.');
  assert.strictEqual(out.lines[4].text, '  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:');
});

test('a Python traceback: its head and its two innermost frames, the assertion, the exit; an error in a post step is listed but is not the failing step', () => {
  const out = extractErrors(python.steps, 40);
  assert.strictEqual(out.failingStep, 'Run pytest -q');
  const S = 'Run pytest -q';
  assert.deepStrictEqual(shape(out), [
    L(S, 5, 'stack'), L(S, 8, 'stack'), L(S, 9, 'stack'), L(S, 10, 'assert'), L(S, 11, 'assert'), L(S, 13, 'exit'),
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
    ['ErrorBoundary rendered', []],
    // From /code-review medium on PR #5.
    ['SyntaxError: Unexpected token }', ['error']],
    ["src/a.ts(1,2): error TS1005: ';' expected.", ['error']],
    ['ERROR: Could not find a version that satisfies the requirement foo', ['error']],
    ['[ERROR] Failed to execute goal org.apache.maven.plugins', ['error']],
    ['not ok 2 - thing # SKIP no network', []],
    ['not ok 3 - later # TODO', []]
  ];
  for (const [line, expected] of cases) assert.deepStrictEqual(kinds(line), expected, line);
});

test('only the first two stack frames after an error are taken', () => {
  const lines = ['Error: boom', '    at a (a.js:1:1)', '    at b (b.js:1:1)', '    at c (c.js:1:1)', 'next', 'x', 'y', 'z'];
  const out = extractErrors([{name: 'Run x', lines}], 40);
  assert.deepStrictEqual(out.lines.filter((l) => l.kind === 'stack').map((l) => l.index), [1, 2]);
});

test('the failing step holds the last exit line: an earlier continue-on-error step is not it', () => {
  const steps = [{name: 'Run flaky', lines: ['##[error]Process completed with exit code 1.']}, {name: 'Run build', lines: ['error: build broke', '##[error]Process completed with exit code 2.']}];
  assert.strictEqual(extractErrors(steps, 40).failingStep, 'Run build');
});

test('a frame that names an error class or an error file is a frame, and only two are taken', () => {
  const lines = ['Error: boom', '    at new ValidationError (/a/errors.js:1:1)', '    at f (/a/src/error.js:2:2)', '    at g (/a/g.js:3:3)', '    at h (/a/h.js:4:4)'];
  const out = extractErrors([{name: 'Run x', lines}], 40);
  assert.deepStrictEqual(out.lines.filter((l) => l.kind !== 'tail').map((l) => [l.index, l.kind]), [[0, 'error'], [1, 'stack'], [2, 'stack']]);
});

test('over maxLines a traceback is kept beside the error lines that follow it', () => {
  const lines = ['Traceback (most recent call last):', '  File "/a/t.py", line 1, in t', '  File "/a/p.py", line 2, in p', 'ValueError: bad',
    ...Array.from({length: 50}, (_, i) => `FAILED tests/test_${i}.py::t`), '##[error]Process completed with exit code 1.'];
  const out = extractErrors([{name: 'Run pytest', lines}], 10);
  assert.deepStrictEqual(out.lines.slice(0, 4).map((l) => [l.index, l.kind]), [[0, 'stack'], [1, 'stack'], [2, 'stack'], [3, 'error']]);
  assert.strictEqual(out.lines[9].kind, 'exit');
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
  assert.strictEqual((await extract({steps: nodeTest.steps, maxLines: 200})).output.lines.length, 8);
});

test('the module is a part: never listed', () => {
  assert.deepStrictEqual(require('../package.json').countinghouse, {role: 'part'});
});
