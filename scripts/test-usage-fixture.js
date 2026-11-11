'use strict';
// Writes a fixture usage directory for ch-report's tests, in the layout and
// record shape of the plan's Global Constraints (amended bfd370c):
// <home>/usage/<YYYY-MM-DD>/<pid>-<startMs>.jsonl, one JSON record per line,
// {t, call, pack, tool, server, bytesIn, linesIn, bytesOut, linesOut, ms,
// outcome, credential}. A record with a server is one call to that server made
// for a tool call (what came in); the record with server null is that tool
// call's result (what went out); `call` ties them. The file names the process.
// No value in it is a secret: credential is a variable's name.
const fs = require('node:fs');
const path = require('node:path');

const PACK = 'ch-pack-ci-failure-triage';
const TOOL = 'ci_failure_triage';

const server = (t, call, bytesIn, linesIn) => ({t, call, pack: PACK, tool: TOOL, server: 'github', bytesIn, linesIn, bytesOut: 0, linesOut: 0, ms: 100, outcome: 'ok', credential: 'GITHUB_TOKEN'});
const result = (t, call, bytesOut, linesOut, outcome = 'ok') => ({t, call, pack: PACK, tool: TOOL, server: null, bytesIn: 0, linesIn: 0, bytesOut, linesOut, ms: 900, outcome, credential: null});

const FILES = {
  // Before the window the tests use (--since 2026-11-10).
  '2026-11-09/1000-1794214800000.jsonl': [server('2026-11-09T09:00:00.000Z', 'c0', 999, 9), result('2026-11-09T09:00:01.000Z', 'c0', 99, 1)],
  '2026-11-10/1111-1794304800000.jsonl': [
    server('2026-11-10T10:00:01.000Z', 'c1', 4000, 100),
    server('2026-11-10T10:00:02.000Z', 'c1', 8000, 300),
    result('2026-11-10T10:00:03.000Z', 'c1', 1200, 30)
  ],
  '2026-11-11/2222-1794391200000.jsonl': [
    server('2026-11-11T10:00:01.000Z', 'c2', 1000, 10),
    server('2026-11-11T10:00:02.000Z', 'c2', 2000, 20),
    server('2026-11-11T10:00:03.000Z', 'c2', 3000, 30),
    result('2026-11-11T10:00:04.000Z', 'c2', 800, 5),
    {t: '2026-11-11T11:00:00.000Z', call: 'c3', pack: 'ch-report', tool: 'usage_report', server: null, bytesIn: 0, linesIn: 0, bytesOut: 402, linesOut: 12, ms: 5, outcome: 'ok', credential: null}
  ]
};

// A process stopped mid-write leaves a truncated last line.
const TRUNCATED = {file: '2026-11-11/3333-1794394800000.jsonl', records: [result('2026-11-11T12:00:00.000Z', 'c4', 400, 4, 'error')], tail: '{"t":"2026-11-11T12:00:01.000Z","call":"c5","pa'};

function writeUsageFixture(home) {
  for (const [rel, records] of Object.entries(FILES)) {
    const file = path.join(home, 'usage', ...rel.split('/'));
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, records.map((r) => JSON.stringify(r) + '\n').join(''));
  }
  const file = path.join(home, 'usage', ...TRUNCATED.file.split('/'));
  fs.writeFileSync(file, TRUNCATED.records.map((r) => JSON.stringify(r) + '\n').join('') + TRUNCATED.tail);
  return home;
}

module.exports = {writeUsageFixture, PACK, TOOL};
