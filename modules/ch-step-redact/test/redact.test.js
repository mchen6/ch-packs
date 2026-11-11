'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
require('../../../test-support/runtime');
const {redactLines, TYPES} = require('../lib/rules');
const redact = require('../handlers/redactService/redact');
const {cases} = require('./fixtures/lines.json');

// Built at run time so no fixture file holds a string a secret scanner flags.
const GHP = 'ghp_' + 'a1B2'.repeat(9);
const PAT = 'github_pat_' + '11ABCDEFG0'.repeat(3) + '_' + 'xY'.repeat(20);
const JWT = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxMjM0NTY3ODkwIn0', 'dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'].join('.');
const BEGIN = '-----BEGIN ' + 'RSA PRIVATE KEY-----';
const END = '-----END ' + 'RSA PRIVATE KEY-----';
const AWS = 'AKIA' + 'IOSFODNN7EXAMPLE';

test('github tokens and bearer headers are masked', () => {
  const r = redactLines(['Authorization: Bearer abcdefghijklmnop1234', 'token ' + GHP]);
  assert.deepStrictEqual(r.lines, ['Authorization: <token>', 'token <githubToken>']);
  assert.strictEqual(r.counts.bearerToken, 1);
  assert.strictEqual(r.counts.githubToken, 1);
});

test('every kind of GitHub token is masked: fine-grained, OAuth, app, refresh', () => {
  const lines = [PAT, 'gho_' + 'z'.repeat(36), 'x-access-token:ghs_' + 'Q'.repeat(36) + '@github.com', 'ghu_' + '9'.repeat(36), 'ghr_' + 'r'.repeat(36)];
  const r = redactLines(lines);
  assert.deepStrictEqual(r.lines, ['<githubToken>', '<githubToken>', 'x-access-token:<githubToken>@github.com', '<githubToken>', '<githubToken>']);
  assert.strictEqual(r.counts.githubToken, 5);
});

test('a lower-case bearer is masked too', () => {
  assert.deepStrictEqual(redactLines(['authorization: bearer abcdefghijklmnop1234']).lines, ['authorization: <token>']);
});

test('a private key block is replaced whole', () => {
  const r = redactLines(['before', BEGIN, 'MIIEowIBAAKCAQEA0Z3VS5JJcds3xfn', END, 'after']);
  assert.deepStrictEqual(r.lines, ['before', '<privateKey>', 'after']);
  assert.strictEqual(r.counts.privateKey, 1);
});

test('a private key on one line, as in a JSON value, is replaced whole', () => {
  const r = redactLines([`"key": "${BEGIN}\\nMIIEowIBAAKCAQEA0Z3VS5JJcds3xfn\\n${END}\\n"`]);
  assert.deepStrictEqual(r.lines, ['"key": "<privateKey>\\n"']);
  assert.strictEqual(r.counts.privateKey, 1);
});

test('a private key block with no end masks everything after its start', () => {
  const r = redactLines(['ok', BEGIN, 'MIIEowIBAAKCAQEA', 'more key']);
  assert.deepStrictEqual(r.lines, ['ok', '<privateKey>']);
  assert.strictEqual(r.counts.privateKey, 1);
});

test('a jwt is masked', () => {
  const r = redactLines([`cookie session=${JWT}; path=/`]);
  assert.deepStrictEqual(r.lines, ['cookie session=<jwt>; path=/']);
  assert.strictEqual(r.counts.jwt, 1);
});

test('an AWS access key id is masked', () => {
  const r = redactLines([`AWS_ACCESS_KEY_ID=${AWS}`, 'ASIA' + 'ABCDEFGHIJKLMNOP']);
  assert.deepStrictEqual(r.lines, ['AWS_ACCESS_KEY_ID=<awsKey>', '<awsKey>']);
  assert.strictEqual(r.counts.awsKey, 2);
});

test('credentials in a url are masked', () => {
  const r = redactLines(['fetch https://user:pw@host/x', 'git clone https://x-access:s3cr3t%40x@github.com/o/r.git']);
  assert.deepStrictEqual(r.lines, ['fetch https://<basicAuth>@host/x', 'git clone https://<basicAuth>@github.com/o/r.git']);
  assert.strictEqual(r.counts.basicAuthUrl, 2);
  // A password that looks like an address is masked as a credential, never half-masked as an e-mail.
  assert.deepStrictEqual(redactLines(['https://bob:pw@example.com/x']).lines, ['https://<basicAuth>@example.com/x']);
});

test('the pii rules of the example still hold', () => {
  for (const [input, expected] of cases) {
    assert.deepStrictEqual(redactLines([input]).lines, [expected], JSON.stringify(input));
  }
});

test('counts carry every type, zero included', () => {
  const r = redactLines(['nothing here']);
  assert.deepStrictEqual(Object.keys(r.counts).sort(), [...TYPES].sort());
  assert.deepStrictEqual(TYPES, ['bearerToken', 'githubToken', 'awsKey', 'privateKey', 'jwt', 'basicAuthUrl', 'email', 'ipv4', 'card', 'phone']);
  assert.ok(Object.values(r.counts).every((n) => n === 0));
});

test('no hostile long line takes more than two seconds', () => {
  const lines = [
    '://' + 'a:'.repeat(100000),
    'eyJ' + 'a'.repeat(200000),
    'eyJ' + 'aaaaaaaaaa.'.repeat(20000),
    'ghp_' + 'a'.repeat(200000),
    'Bearer ' + 'a'.repeat(200000),
    'a'.repeat(200000),
    BEGIN.repeat(5000)
  ];
  const start = Date.now();
  redactLines(lines);
  const ms = Date.now() - start;
  assert.ok(ms < 2000, `took ${ms} ms`);
});

test('handler validates input and returns counts for every type', async () => {
  const {output} = await redact({lines: ['token ' + GHP, 'mail bob.ortiz@example.com']});
  assert.deepStrictEqual(output.lines, ['token <githubToken>', 'mail <email>']);
  assert.deepStrictEqual(Object.keys(output.counts).sort(), [...TYPES].sort());
  assert.strictEqual(output.counts.githubToken, 1);
  assert.strictEqual(output.counts.email, 1);
  for (const bad of [{}, {lines: 'x'}, {lines: ['ok', 7]}, null]) {
    await assert.rejects(redact(bad), (err) => err.code === 'ARGUMENTS_INVALID', JSON.stringify(bad));
  }
});

test('the module is a part: never listed', () => {
  const pkg = require(path.join(__dirname, '..', 'package.json'));
  assert.deepStrictEqual(pkg.countinghouse, {role: 'part'});
});
