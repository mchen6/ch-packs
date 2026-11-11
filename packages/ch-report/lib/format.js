'use strict';
// The report as text for a person and as CSV for a spreadsheet. Exact lines and
// bytes; token columns labelled as the estimate they are. It reports what was
// read and what was returned, never what was "saved".

const CSV_HEADER = 'pack,tool,calls,server_calls,bytes_in,lines_in,bytes_out,lines_out,tokens_in_est,tokens_out_est';

const n = (x) => x.toLocaleString('en-US');
function size(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatText(agg) {
  const t = agg.totals;
  if (t.calls + t.serverCalls === 0) return 'no usage recorded\n';
  const lines = [
    `${n(t.calls)} tool calls stood for ${n(t.serverCalls)} server calls, from ${agg.processes.length} launcher process(es).`,
    `read ${n(t.linesIn)} lines (${size(t.bytesIn)}) from servers; ${n(t.linesOut)} lines (${size(t.bytesOut)}) returned to the model.`,
    `tokens, estimate (bytes/4): about ${n(t.tokensInEst)} read, ${n(t.tokensOutEst)} returned.`,
    '',
    'by tool: calls, server calls, lines in, bytes in, lines out, bytes out, tokens in and out (estimate, bytes/4)'
  ];
  for (const x of agg.byTool) {
    lines.push(`  ${x.pack} ${x.tool}: ${n(x.calls)}, ${n(x.serverCalls)}, ${n(x.linesIn)}, ${size(x.bytesIn)}, ${n(x.linesOut)}, ${size(x.bytesOut)}, ~${n(x.tokensInEst)}, ~${n(x.tokensOutEst)}`);
  }
  if (agg.byServer.length) {
    lines.push('', 'by server: calls, lines in, bytes in, credential used (by name)');
    for (const s of agg.byServer) lines.push(`  ${s.server}: ${n(s.serverCalls)}, ${n(s.linesIn)}, ${size(s.bytesIn)}, ${s.credentials.join(', ') || 'none'}`);
  }
  return lines.join('\n') + '\n';
}

const cell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

function formatCsv(agg) {
  const rows = agg.byTool.map((x) => [x.pack, x.tool, x.calls, x.serverCalls, x.bytesIn, x.linesIn, x.bytesOut, x.linesOut, x.tokensInEst, x.tokensOutEst].map(cell).join(','));
  return [CSV_HEADER, ...rows].join('\n') + '\n';
}

module.exports = {formatText, formatCsv, CSV_HEADER};
