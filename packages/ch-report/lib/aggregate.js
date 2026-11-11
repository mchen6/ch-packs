'use strict';
// The layer-1 report: exact sums of what the runtime counted, per process,
// tool, server and pack. A record with a server is one server call made for a
// tool call (bytes and lines in); one with server null is a tool call's result
// (bytes and lines out). Tokens are not counted by anyone here: the token
// columns are an estimate, UTF-8 bytes / 4, and say so wherever they appear.

const ESTIMATE_METHOD = 'utf8 bytes / 4';
const est = (bytes) => Math.round(bytes / 4);

const zero = () => ({calls: 0, serverCalls: 0, bytesIn: 0, linesIn: 0, bytesOut: 0, linesOut: 0});
function add(sum, r) {
  if (r.server === null) sum.calls++; else sum.serverCalls++;
  sum.bytesIn += r.bytesIn;
  sum.linesIn += r.linesIn;
  sum.bytesOut += r.bytesOut;
  sum.linesOut += r.linesOut;
  return sum;
}
const withEstimates = (s) => ({...s, tokensInEst: est(s.bytesIn), tokensOutEst: est(s.bytesOut)});

function groupBy(records, keyOf, init) {
  const groups = new Map();
  for (const r of records) {
    const key = keyOf(r);
    if (!groups.has(key)) groups.set(key, {...init(r), ...zero()});
    add(groups.get(key), r);
  }
  return [...groups.values()];
}

const byCalls = (a, b) => (b.calls - a.calls) || (b.serverCalls - a.serverCalls);

// records (readUsage's) -> the report object.
function aggregate(records) {
  const processes = groupBy(records, (r) => r.process, (r) => {
    const [pid, startMs] = String(r.process).split('-').map(Number);
    return {process: r.process, pid, started: Number.isFinite(startMs) ? new Date(startMs).toISOString() : null, first: r.t, last: r.t};
  });
  for (const p of processes) {
    const ts = records.filter((r) => r.process === p.process).map((r) => r.t).sort();
    p.first = ts[0];
    p.last = ts[ts.length - 1];
  }
  const byTool = groupBy(records, (r) => `${r.pack}\n${r.tool}`, (r) => ({pack: r.pack, tool: r.tool})).sort(byCalls);
  const byPack = groupBy(records, (r) => r.pack, (r) => ({pack: r.pack})).sort(byCalls);
  const byServer = groupBy(records.filter((r) => r.server !== null), (r) => r.server, (r) => ({server: r.server}))
    .map((s) => ({
      server: s.server, serverCalls: s.serverCalls, bytesIn: s.bytesIn, linesIn: s.linesIn, tokensInEst: est(s.bytesIn),
      credentials: [...new Set(records.filter((r) => r.server === s.server && typeof r.credential === 'string').map((r) => r.credential))].sort()
    }))
    .sort((a, b) => b.serverCalls - a.serverCalls);
  const outcomes = {};
  for (const r of records) if (r.server === null) outcomes[r.outcome] = (outcomes[r.outcome] || 0) + 1;
  const totals = withEstimates(records.reduce(add, zero()));
  return {
    processes: processes.map(withEstimates),
    byTool: byTool.map(withEstimates),
    byServer,
    byPack: byPack.map(withEstimates),
    totals,
    replaced: byTool.filter((t) => t.serverCalls > 0).map((t) => ({pack: t.pack, tool: t.tool, packCalls: t.calls, serverCalls: t.serverCalls})),
    outcomes,
    estimateMethod: ESTIMATE_METHOD
  };
}

module.exports = {aggregate, ESTIMATE_METHOD};
