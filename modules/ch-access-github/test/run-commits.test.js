'use strict';
const test = require('node:test');
const assert = require('node:assert');
require('../../../test-support/runtime');
const {fakeCtx, fixture, body} = require('./support/fake-ctx');
const runCommits = require('../handlers/githubService/runCommits');

const SHA = '5c23de037f76a066f7b40fbf9ba4c993ceed8c42';

test('runCommits strips emails and keeps logins', async () => {
  const ctx = fakeCtx({list_commits: fixture('list_commits')});
  const {output} = await runCommits({repo: 'mchen6/countinghouse', commit: SHA}, ctx);
  assert.deepStrictEqual(output, {commit: SHA, authorLogin: body('list_commits')[0].author.login});
  assert.match(output.authorLogin, /^[A-Za-z0-9-]+$/);
  const text = JSON.stringify(output);
  assert.ok(!text.includes('removed@example.invalid') && !text.includes('Example Author') && !text.includes('@'));
  assert.deepStrictEqual(ctx.calls, [{address: 'remote:github/list_commits', args: {owner: 'mchen6', repo: 'countinghouse', sha: SHA, perPage: 1}}]);
});

test('a commit with no GitHub account gives authorLogin null', async () => {
  const [c] = body('list_commits');
  const noAccount = {result: {content: [{type: 'text', text: JSON.stringify([{...c, author: null}])}]}};
  const {output} = await runCommits({repo: 'mchen6/countinghouse', commit: SHA}, fakeCtx({list_commits: noAccount}));
  assert.deepStrictEqual(output, {commit: SHA, authorLogin: null});
});

test('the commit answered is the one asked for, or the call fails', async () => {
  const [c] = body('list_commits');
  const other = {result: {content: [{type: 'text', text: JSON.stringify([{...c, sha: 'f'.repeat(40)}])}]}};
  await assert.rejects(runCommits({repo: 'mchen6/countinghouse', commit: SHA}, fakeCtx({list_commits: other})), (err) => err.code === 'COMMIT_NOT_FOUND');
  const none = {result: {content: [{type: 'text', text: '[]'}]}};
  await assert.rejects(runCommits({repo: 'mchen6/countinghouse', commit: SHA}, fakeCtx({list_commits: none})), (err) => err.code === 'COMMIT_NOT_FOUND');
});

test('runCommits validates its input', async () => {
  const ctx = fakeCtx({});
  const invalid = (err) => err.code === 'ARGUMENTS_INVALID';
  for (const bad of [null, {}, {repo: 'a/b'}, {repo: 'a/b', commit: 'xyz'}, {repo: 'a/b', commit: 'abc'}, {repo: 'a', commit: SHA}]) {
    await assert.rejects(runCommits(bad, ctx), invalid, JSON.stringify(bad));
  }
  assert.strictEqual(ctx.calls.length, 0);
});
