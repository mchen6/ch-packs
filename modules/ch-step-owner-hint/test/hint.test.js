'use strict';
const test = require('node:test');
const assert = require('node:assert');
require('../../../test-support/runtime');
const {ownerHint} = require('../lib/hint');
const hint = require('../handlers/ownerService/hint');

const FIRST = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const C2 = 'b'.repeat(40);
const C3 = 'c'.repeat(40);
const C4 = 'd'.repeat(40);

test('hint lists the first-seen author first and never an email', async () => {
  const out = ownerHint({firstSeen: {commit: FIRST, authorLogin: 'octocat'}, stepCommits: [{commit: C2, authorLogin: 'hubot'}, {commit: C3, authorLogin: 'octocat'}]});
  assert.deepStrictEqual(out, {
    logins: ['octocat', 'hubot'],
    why: [
      'octocat: author of a1b2c3d, the commit where this failure first appeared',
      'hubot: author of bbbbbbb, a recent change before this failure'
    ]
  });
  await assert.rejects(hint({firstSeen: {commit: FIRST, authorLogin: 'octo@example.com'}, stepCommits: []}), (err) => err.code === 'ARGUMENTS_INVALID');
  await assert.rejects(hint({firstSeen: {commit: FIRST, authorLogin: null}, stepCommits: [{commit: C2, authorLogin: 'Octo Cat <octo@example.com>'}]}), (err) => err.code === 'ARGUMENTS_INVALID');
});

test('hint returns empty logins with an empty why when nothing is known', () => {
  assert.deepStrictEqual(ownerHint({firstSeen: {commit: FIRST, authorLogin: null}, stepCommits: []}), {logins: [], why: []});
  assert.deepStrictEqual(ownerHint({firstSeen: null, stepCommits: [{commit: C2, authorLogin: null}]}), {logins: [], why: []});
});

test('at most three logins, first-seen first, then recent changes in order, each once', () => {
  const out = ownerHint({firstSeen: {commit: FIRST, authorLogin: null}, stepCommits: [
    {commit: C2, authorLogin: 'a-one'}, {commit: C3, authorLogin: 'dependabot[bot]'}, {commit: C2, authorLogin: 'a-one'}, {commit: C4, authorLogin: 'three'}, {commit: C4, authorLogin: 'four'}
  ]});
  assert.deepStrictEqual(out.logins, ['a-one', 'dependabot[bot]', 'three']);
  assert.strictEqual(out.why.length, 3);
});

test('handler refuses what is not a GitHub login', async () => {
  const invalid = (err) => err.code === 'ARGUMENTS_INVALID';
  for (const login of ['', '-leading', 'has space', 'a'.repeat(40), 'x\ny', 7]) {
    await assert.rejects(hint({firstSeen: {commit: FIRST, authorLogin: login}, stepCommits: []}), invalid, JSON.stringify(login));
  }
  for (const bad of [{}, null, {firstSeen: {commit: FIRST, authorLogin: 'ok'}}, {firstSeen: {authorLogin: 'ok'}, stepCommits: []}, {firstSeen: null, stepCommits: [{commit: 'xyz', authorLogin: 'ok'}]}]) {
    await assert.rejects(hint(bad), invalid, JSON.stringify(bad));
  }
  const {output} = await hint({firstSeen: {commit: FIRST, authorLogin: 'octocat'}, stepCommits: []});
  assert.deepStrictEqual(output.logins, ['octocat']);
});

test('the module is a part: never listed', () => {
  assert.deepStrictEqual(require('../package.json').countinghouse, {role: 'part'});
});
