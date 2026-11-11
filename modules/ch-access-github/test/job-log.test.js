'use strict';
const test = require('node:test');
const assert = require('node:assert');
require('../../../test-support/runtime');
const {fakeCtx, fixture, body} = require('./support/fake-ctx');
const jobLog = require('../handlers/githubService/jobLog');
const {expiryOf} = require('../lib/remote');

test('jobLog returns the text with line and byte counts', async () => {
  const ctx = fakeCtx({get_job_logs: fixture('get_job_logs-129693708246')});
  const {output} = await jobLog({repo: 'mchen6/countinghouse', jobId: '129693708246'}, ctx);
  const text = body('get_job_logs-129693708246').logs_content;
  assert.deepStrictEqual(output, {text, lines: 1539, bytes: Buffer.byteLength(text, 'utf8'), expired: false, truncated: false});
  assert.deepStrictEqual(ctx.calls[0], {address: 'remote:github/get_job_logs', args: {owner: 'mchen6', repo: 'countinghouse', job_id: 129693708246, return_content: true, tail_lines: 200000}});
});

test('expired logs are counted, not fatal: 410 Gone', async () => {
  const ctx = fakeCtx({get_job_logs: fixture('get_job_logs-expired')});
  const {output} = await jobLog({repo: 'mchen6/countinghouse', jobId: '93100912193'}, ctx);
  assert.deepStrictEqual(output, {text: '', lines: 0, bytes: 0, expired: true, truncated: false});
});

test('a log that is not there counts as expired: 404 Not Found', async () => {
  const ctx = fakeCtx({get_job_logs: fixture('get_job_logs-notfound')});
  const {output} = await jobLog({repo: 'mchen6/countinghouse', jobId: '1'}, ctx);
  assert.deepStrictEqual(output, {text: '', lines: 0, bytes: 0, expired: true, truncated: false});
});

test('expiry is read from the error text in both recorded forms', () => {
  const jobForm = fixture('get_job_logs-expired').result.content[0].text;
  const runForm = body('get_job_logs-expired-run').logs[0].error;
  assert.strictEqual(expiryOf(jobForm), true);
  assert.strictEqual(expiryOf(runForm), true);
  assert.strictEqual(expiryOf(fixture('get_job_logs-notfound').result.content[0].text), true);
  assert.strictEqual(expiryOf('failed to get job logs for job 1: unexpected status code: 500 Internal Server Error'), false);
  assert.strictEqual(expiryOf('rate limit: 4101 requests'), false);
});

test('any other error is a log unavailable, not an expiry', async () => {
  const other = {result: {isError: true, content: [{type: 'text', text: 'failed to get job logs for job 7: unexpected status code: 502 Bad Gateway'}]}};
  const ctx = fakeCtx({get_job_logs: other});
  await assert.rejects(jobLog({repo: 'mchen6/countinghouse', jobId: '7'}, ctx), (err) => err.code === 'LOG_UNAVAILABLE'
    && /502 Bad Gateway/.test(err.details.serverText)
    && !/502/.test(err.message)); // the server's words ride in the details, not the message
});

// The recorded log, as if the server had cut it: original_length says 1539, fewer lines came.
const cut = (n) => {
  const b = body('get_job_logs-129693708246');
  const text = b.logs_content.split('\n').slice(-n).join('\n');
  return {result: {content: [{type: 'text', text: JSON.stringify({...b, logs_content: text})}]}};
};

test('a log cut short by the server says truncated', async () => {
  const ctx = fakeCtx({get_job_logs: cut(1000)});
  const {output} = await jobLog({repo: 'mchen6/countinghouse', jobId: '129693708246'}, ctx);
  assert.strictEqual(output.lines, 1000);
  assert.strictEqual(output.truncated, true);
  assert.strictEqual(output.expired, false);
});

test('a trailing newline is not a line', async () => {
  const b = body('get_job_logs-129693708246');
  const ended = {result: {content: [{type: 'text', text: JSON.stringify({...b, logs_content: b.logs_content + '\n'})}]}};
  const {output} = await jobLog({repo: 'mchen6/countinghouse', jobId: '129693708246'}, fakeCtx({get_job_logs: ended}));
  assert.deepStrictEqual([output.lines, output.truncated], [1539, false]);
});

test('jobLog validates its input', async () => {
  const ctx = fakeCtx({});
  const invalid = (err) => err.code === 'ARGUMENTS_INVALID';
  for (const bad of [null, {}, {repo: 'a/b'}, {repo: 'a/b', jobId: 5}, {repo: 'a/b', jobId: '5a'}, {repo: 'a', jobId: '5'}]) {
    await assert.rejects(jobLog(bad, ctx), invalid, JSON.stringify(bad));
  }
  assert.strictEqual(ctx.calls.length, 0);
});

// From /code-review medium on PR #32.
test('without original_length, a log that fills the requested tail is truncated', async () => {
  const lines = (n) => Array.from({length: n}, (_, i) => `synthetic line ${i + 1}`).join('\n');
  const answer = (text) => ({result: {content: [{type: 'text', text: JSON.stringify({job_id: 1, logs_content: text, message: 'ok'})}]}});
  const full = await jobLog({repo: 'mchen6/countinghouse', jobId: '1'}, fakeCtx({get_job_logs: answer(lines(200000))}));
  assert.deepStrictEqual([full.output.lines, full.output.truncated], [200000, true]);
  const small = await jobLog({repo: 'mchen6/countinghouse', jobId: '1'}, fakeCtx({get_job_logs: answer(lines(20))}));
  assert.deepStrictEqual([small.output.lines, small.output.truncated], [20, false]);
});
