'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {writeUsageFixture, PACK, TOOL} = require('../../../scripts/test-usage-fixture');
const {readUsage} = require('../lib/read');
const {aggregate, ESTIMATE_METHOD} = require('../lib/aggregate');
const {formatText, formatCsv, CSV_HEADER} = require('../lib/format');
const {report} = require('../lib/report');

const BIN = path.join(__dirname, '..', 'bin', 'ch-report.js');
let home;
test.before(() => { home = writeUsageFixture(fs.mkdtempSync(path.join(os.tmpdir(), 'ch-report-'))); });
test.after(() => fs.rmSync(home, {recursive: true, force: true}));

test('reads every file in the window and skips a truncated last line', () => {
  const all = readUsage(home, {});
  assert.strictEqual(all.length, 12); // 2 + 3 + 5 + 2, the truncated line skipped
  const windowed = readUsage(home, {since: '2026-11-10', until: '2026-11-10'});
  assert.deepStrictEqual(windowed.map((r) => r.call), [1, 1, 1]);
  assert.ok(windowed.every((r) => r.process === '1111-1794304800000'));
  assert.deepStrictEqual(readUsage(path.join(home, 'nowhere'), {}), []);
});

test('records keep only the fields that apply: absent counters are 0, an absent server is null', () => {
  const [inRecord, outRecord] = readUsage(home, {since: '2026-11-10', until: '2026-11-10'}).filter((_, i) => i !== 1);
  assert.strictEqual(inRecord.bytesOut, 0);
  assert.strictEqual(outRecord.server, null);
  assert.strictEqual(outRecord.bytesIn, 0);
});

test('a record is read by its own date, whatever day its directory is named for', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ch-report-tz-'));
  try {
    fs.mkdirSync(path.join(dir, 'usage', '2026-11-12'), {recursive: true});
    fs.writeFileSync(path.join(dir, 'usage', '2026-11-12', '9-1794450000000.jsonl'),
      JSON.stringify({t: '2026-11-11T16:00:00.000Z', call: 1, pack: 'p', tool: 't', bytesOut: 4, linesOut: 1, ms: 1, outcome: 'ok'}) + '\n');
    assert.strictEqual(readUsage(dir, {until: '2026-11-11'}).length, 1);
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

test('aggregates per process, tool, server and pack with exact sums, server calls joined to their tool call', () => {
  const agg = aggregate(readUsage(home, {since: '2026-11-10'}));
  assert.deepStrictEqual(agg.totals, {calls: 4, serverCalls: 6, bytesIn: 18500, linesIn: 465, bytesOut: 2802, linesOut: 51, tokensInEst: 4625, tokensOutEst: 701});
  assert.deepStrictEqual(agg.processes.map((p) => [p.process, p.calls, p.serverCalls, p.bytesIn, p.bytesOut, p.first, p.last]), [
    ['1111-1794304800000', 1, 2, 12000, 1200, '2026-11-10T10:00:01.000Z', '2026-11-10T10:00:03.000Z'],
    ['2222-1794391200000', 2, 3, 6000, 1202, '2026-11-11T10:00:01.000Z', '2026-11-11T11:00:00.000Z'],
    ['3333-1794394800000', 1, 1, 500, 400, '2026-11-11T12:00:00.000Z', '2026-11-11T12:00:05.000Z']
  ]);
  assert.strictEqual(agg.processes[0].pid, 1111);
  assert.strictEqual(agg.processes[0].started, '2026-11-10T10:00:00.000Z');
  assert.deepStrictEqual(agg.byTool.map((t) => [t.pack, t.tool, t.calls, t.serverCalls, t.linesIn, t.linesOut]), [
    [PACK, TOOL, 3, 5, 460, 39],
    ['ch-report', 'usage_report', 1, 0, 0, 12],
    ['(unknown)', '(no result recorded)', 0, 1, 5, 0] // the call a stopped process never finished
  ]);
  assert.deepStrictEqual(agg.byServer, [{server: 'github', serverCalls: 6, bytesIn: 18500, linesIn: 465, tokensInEst: 4625, credentials: ['GITHUB_TOKEN'], tools: {actions_list: 2, get_job_logs: 4}}]);
  assert.deepStrictEqual(agg.byPack.map((p) => [p.pack, p.calls, p.serverCalls]), [[PACK, 3, 5], ['ch-report', 1, 0], ['(unknown)', 0, 1]]);
  assert.deepStrictEqual(agg.outcomes, {ok: 3, error: 1});
});

test('replaced counts one pack call as N server calls', () => {
  const agg = aggregate(readUsage(home, {since: '2026-11-10'}));
  assert.deepStrictEqual(agg.replaced, [{pack: PACK, tool: TOOL, packCalls: 3, serverCalls: 5}]);
});

test('token estimates are bytes/4 and every rendering carries the estimate label', () => {
  const agg = aggregate(readUsage(home, {}));
  assert.strictEqual(ESTIMATE_METHOD, 'utf8 bytes / 4');
  assert.strictEqual(agg.estimateMethod, ESTIMATE_METHOD);
  assert.strictEqual(agg.totals.tokensInEst, Math.round(agg.totals.bytesIn / 4));
  assert.match(formatText(agg), /tokens, estimate \(bytes\/4\)/);
  assert.ok(formatCsv(agg).startsWith(CSV_HEADER + '\n'));
  assert.match(CSV_HEADER, /tokens_in_est,tokens_out_est/);
});

test('csv has one row per tool with the fixed header', () => {
  const csv = formatCsv(aggregate(readUsage(home, {since: '2026-11-10'})));
  assert.strictEqual(CSV_HEADER, 'pack,tool,calls,server_calls,bytes_in,lines_in,bytes_out,lines_out,tokens_in_est,tokens_out_est');
  assert.deepStrictEqual(csv.split('\n'), [
    CSV_HEADER,
    `${PACK},${TOOL},3,5,18000,460,2400,39,4500,600`,
    'ch-report,usage_report,1,0,0,0,402,12,0,101',
    '(unknown),(no result recorded),0,1,500,5,0,0,125,0',
    ''
  ]);
  assert.strictEqual(formatCsv(aggregate([{t: '2026-11-11T00:00:00Z', call: 1, process: '1-1', pack: 'a,"b"', tool: 't', server: null, bytesIn: 0, linesIn: 0, bytesOut: 4, linesOut: 1, ms: 1, outcome: 'ok'}])).split('\n')[1],
    '"a,""b""",t,1,0,0,0,4,1,0,1');
});

test('text output states what pack calls stood for, per pack, tool, server and process, and never says saved', () => {
  const text = formatText(aggregate(readUsage(home, {since: '2026-11-10'})));
  assert.match(text, /^3 pack calls stood for 5 server calls; 4 tool calls in all, from 3 launcher process\(es\)\.$/m);
  assert.match(text, /read 465 lines \(18\.1 KB\) from servers; 51 lines \(2\.7 KB\) returned to the model/);
  for (const heading of ['by pack:', 'by tool:', 'by server:', 'by process:']) assert.ok(text.includes(heading), heading);
  assert.match(text, /ci_failure_triage: 3 calls stood for 5 server calls/);
  assert.doesNotMatch(text, /saved/i);
  assert.match(formatText(aggregate([])), /^no usage recorded/);
});

test('dates must exist, and since must not come after until', () => {
  for (const args of [{since: '2026-13-45'}, {until: '2026-02-30'}, {since: '2026-11-12', until: '2026-11-10'}]) {
    assert.throws(() => report(home, args), /must|after/, JSON.stringify(args));
  }
});

test('the command line prints text, JSON or CSV, and refuses bad options', () => {
  const run = (...args) => spawnSync(process.execPath, [BIN, '--home', home, ...args], {encoding: 'utf8'});
  const json = run('--json', '--since', '2026-11-10');
  assert.strictEqual(json.status, 0, json.stderr);
  assert.deepStrictEqual(JSON.parse(json.stdout).totals.calls, 4);
  assert.strictEqual(run('--csv').stdout.split('\n')[0], CSV_HEADER);
  assert.match(run().stdout, /pack calls stood for/);
  for (const bad of [['--since', 'yesterday'], ['--json', '--csv'], ['--bogus'], ['--home']]) {
    const r = spawnSync(process.execPath, [BIN, ...bad], {encoding: 'utf8'});
    assert.strictEqual(r.status, 1, bad.join(' '));
    assert.match(r.stderr, /usage: ch-report/);
  }
});

const mcp = (lines, ...args) => spawnSync(process.execPath, [path.join(__dirname, '..', 'mcp', 'server.js'), ...args],
  {input: lines.join('\n') + '\n', encoding: 'utf8', timeout: 20000});

test('the MCP server answers tools/list with usage_report and tools/call with the aggregate', () => {
  const messages = [
    {jsonrpc: '2.0', id: 1, method: 'initialize', params: {protocolVersion: '2026-07-28', capabilities: {}, clientInfo: {name: 't', version: '0'}}},
    {jsonrpc: '2.0', method: 'notifications/initialized'},
    {jsonrpc: '2.0', id: 2, method: 'tools/list'},
    {jsonrpc: '2.0', id: 3, method: 'tools/call', params: {name: 'usage_report', arguments: {since: '2026-11-10'}}},
    {jsonrpc: '2.0', id: 4, method: 'tools/call', params: {name: 'usage_report', arguments: {since: 'soon'}}},
    {jsonrpc: '2.0', id: 5, method: 'no/such'},
    {jsonrpc: '2.0', id: 6, method: 'tools/call', params: {name: 'usage_report', arguments: {util: '2026-11-11'}}}
  ];
  const r = mcp(messages.map((m) => JSON.stringify(m)), '--home', home);
  const out = r.stdout.trim().split('\n').map((l) => JSON.parse(l));
  assert.deepStrictEqual(out.map((m) => m.id), [1, 2, 3, 4, 5, 6]);
  assert.strictEqual(out[0].result.protocolVersion, '2026-07-28');
  assert.deepStrictEqual(out[1].result.tools.map((t) => t.name), ['usage_report']);
  assert.strictEqual(out[2].result.structuredContent.totals.calls, 4);
  assert.match(out[2].result.content[0].text, /pack calls stood for/);
  assert.strictEqual(out[3].result.isError, true);
  assert.strictEqual(out[4].error.code, -32601);
  assert.strictEqual(out[5].result.isError, true); // a misspelt argument is refused, not ignored
  assert.match(out[5].result.content[0].text, /util/);
});

test('the MCP server answers a message that is not a request object and keeps serving', () => {
  const r = mcp(['null', '[]', '7', JSON.stringify({jsonrpc: '2.0', id: 9, method: 'ping'})], '--home', home);
  const out = r.stdout.trim().split('\n').map((l) => JSON.parse(l));
  assert.deepStrictEqual(out.map((m) => [m.id, m.error ? m.error.code : 'ok']), [[null, -32600], [null, -32600], [null, -32600], [9, 'ok']]);
});

test('the MCP server refuses --home without a value', () => {
  const r = mcp([], '--home');
  assert.strictEqual(r.status, 1);
  assert.strictEqual(r.stderr, 'ch-report-mcp: --home needs a value\nusage: ch-report-mcp [--home <dir>]\n');
  assert.strictEqual(r.stdout, '');
});
