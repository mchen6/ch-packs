'use strict';
const test = require('node:test');
const assert = require('node:assert');
require('../../../test-support/runtime');
const {fakeCtx, fixture, body} = require('./support/fake-ctx');
const failedJobs = require('../handlers/githubService/failedJobs');
const {collectFailedJobs} = require('../lib/jobs');

test('failedJobs reads the nested jobs list and keeps only failed jobs with their steps', async () => {
  const ctx = fakeCtx({actions_list: fixture('list_workflow_jobs')});
  const {output} = await failedJobs({repo: 'mchen6/countinghouse', runId: '42775507169'}, ctx);
  assert.deepStrictEqual(output.jobs.map((j) => [j.jobId, j.name, j.conclusion]), [
    ['129693708246', 'test (26)', 'failure'],
    ['129693708268', 'test (24)', 'failure'],
    ['129693708323', 'test (24.15.0)', 'failure']
  ]);
  for (const j of output.jobs) {
    assert.deepStrictEqual(Object.keys(j), ['jobId', 'name', 'conclusion', 'steps']);
    for (const s of j.steps) assert.deepStrictEqual(Object.keys(s), ['name', 'conclusion']);
    assert.deepStrictEqual(j.steps.filter((s) => s.conclusion === 'failure').map((s) => s.name), ['Run functional tests']);
  }
  assert.deepStrictEqual(ctx.calls[0].args, {method: 'list_workflow_jobs', owner: 'mchen6', repo: 'countinghouse', resource_id: '42775507169', perPage: 100, page: 1});
});

test('a page shorter than total_count is followed by the next page', async () => {
  const all = body('list_workflow_jobs').jobs.jobs;
  // Page 1 is the recorded perPage 2 page; page 2 is the rest of the recorded list, in the same envelope.
  const page2 = {result: {content: [{type: 'text', text: JSON.stringify({jobs: {total_count: 4, jobs: all.slice(2)}})}]}};
  const ctx = fakeCtx({actions_list: (args) => (args.page === 1 ? fixture('list_workflow_jobs-page') : page2)});
  const jobs = await collectFailedJobs(ctx, {owner: 'mchen6', repo: 'countinghouse', runId: '42775507169'}, 2);
  assert.strictEqual(jobs.length, 3);
  assert.deepStrictEqual(ctx.calls.map((c) => c.args.page), [1, 2]);
});

test('an empty page ends the walk even when total_count says more', async () => {
  const empty = {result: {content: [{type: 'text', text: JSON.stringify({jobs: {total_count: 9, jobs: []}})}]}};
  const ctx = fakeCtx({actions_list: (args) => (args.page === 1 ? fixture('list_workflow_jobs-page') : empty)});
  await collectFailedJobs(ctx, {owner: 'mchen6', repo: 'countinghouse', runId: '42775507169'}, 2);
  assert.deepStrictEqual(ctx.calls.map((c) => c.args.page), [1, 2]);
});

test('failedJobs validates its input', async () => {
  const ctx = fakeCtx({});
  const invalid = (err) => err.code === 'ARGUMENTS_INVALID';
  for (const bad of [null, {}, {repo: 'a/b'}, {repo: 'a/b', runId: 42}, {repo: 'a/b', runId: 'x1'}, {repo: 'ab', runId: '1'}]) {
    await assert.rejects(failedJobs(bad, ctx), invalid, JSON.stringify(bad));
  }
  assert.strictEqual(ctx.calls.length, 0);
});

// From /code-review medium on PR #32.
test('a job list longer than the page cap is an error, never a silent partial list', async () => {
  const page = fixture('list_workflow_jobs-page');
  const many = {result: {content: [{type: 'text', text: JSON.stringify({jobs: {total_count: 5000, jobs: body('list_workflow_jobs-page').jobs.jobs}})}]}};
  const ctx = fakeCtx({actions_list: (args) => (args.page === 1 ? page : many)});
  await assert.rejects(collectFailedJobs(ctx, {owner: 'mchen6', repo: 'countinghouse', runId: '42775507169'}, 2), (err) => err.code === 'JOBS_INCOMPLETE');
});
