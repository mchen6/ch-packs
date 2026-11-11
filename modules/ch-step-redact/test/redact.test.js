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
const JWT = ['eyJ' + 'h'.repeat(17), 'eyJ' + 'y'.repeat(20), 'sig' + 'x'.repeat(40)].join('.');
const BEGIN = '-----BEGIN ' + 'RSA PRIVATE KEY-----';
const END = '-----END ' + 'RSA PRIVATE KEY-----';
const AWS = 'AKIA' + 'IOSFODNN7EXAMPLE';
const KEY_BODY = 'MII' + 'A'.repeat(28);

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
  const r = redactLines(['before', BEGIN, KEY_BODY, END, 'after']);
  assert.deepStrictEqual(r.lines, ['before', '<privateKey>', 'after']);
  assert.strictEqual(r.counts.privateKey, 1);
});

test('a private key on one line, as in a JSON value, is replaced whole', () => {
  const r = redactLines([`"key": "${BEGIN}\\n${KEY_BODY}\\n${END}\\n"`]);
  assert.deepStrictEqual(r.lines, ['"key": "<privateKey>\\n"']);
  assert.strictEqual(r.counts.privateKey, 1);
});

test('a private key block with no end masks everything after its start', () => {
  const r = redactLines(['ok', BEGIN, KEY_BODY, 'more key']);
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

// From /code-review medium on PR #3.
test('many jwt-like starts on one line stay linear', () => {
  const start = Date.now();
  redactLines(['-eyJ'.repeat(20000), ('eyJ' + 'a'.repeat(12) + '-').repeat(10000)]);
  const ms = Date.now() - start;
  assert.ok(ms < 2000, `took ${ms} ms`);
});

test('a PGP private key block is replaced whole', () => {
  const r = redactLines(['-----BEGIN PGP ' + 'PRIVATE KEY BLOCK-----', '', KEY_BODY, '-----END PGP ' + 'PRIVATE KEY BLOCK-----', 'after']);
  assert.deepStrictEqual(r.lines, ['<privateKey>', 'after']);
  assert.strictEqual(r.counts.privateKey, 1);
});

test('URL credentials: long, password-only or user-only are masked; a port and a later @ are not credentials', () => {
  const long = 'p'.repeat(300);
  assert.deepStrictEqual(redactLines([`https://u:${long}@host/x`]).lines, ['https://<basicAuth>@host/x']);
  assert.deepStrictEqual(redactLines(['https://:hunter2hunter2@host/x']).lines, ['https://<basicAuth>@host/x']);
  assert.deepStrictEqual(redactLines(['git clone https://' + 'T'.repeat(30) + '@github.com/o/r']).lines, ['git clone https://<basicAuth>@github.com/o/r']);
  const r = redactLines(['see https://example.com:443/u/alice@example.com']);
  assert.deepStrictEqual(r.lines, ['see https://example.com:443/u/<email>']);
  assert.strictEqual(r.counts.basicAuthUrl, 0);
});

test('a token used as a URL password is counted once', () => {
  const r = redactLines([`https://x-access-token:${GHP}@github.com/o/r`]);
  assert.deepStrictEqual(r.lines, ['https://<basicAuth>@github.com/o/r']);
  assert.strictEqual(r.counts.basicAuthUrl + r.counts.githubToken, 1);
});

test('Basic and token authorization headers, AWS secret keys, and a GitHub token after a name are masked', () => {
  const r = redactLines([
    'Authorization: Basic ' + 'dXNlcjpw'.repeat(3) + '==',
    'Authorization: token ' + 'f'.repeat(40),
    'aws_secret_access_key = ' + 'w'.repeat(40),
    'AWS_SECRET_ACCESS_KEY=' + 'W'.repeat(40),
    'GH_TOKEN_' + GHP
  ]);
  assert.deepStrictEqual(r.lines, ['Authorization: <token>', 'Authorization: <token>', 'aws_secret_access_key = <awsKey>', 'AWS_SECRET_ACCESS_KEY=<awsKey>', 'GH_TOKEN_<githubToken>']);
});
