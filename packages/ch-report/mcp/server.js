#!/usr/bin/env node
'use strict';
// A standard stdio MCP server with one tool, usage_report: the same report as
// the command line, with no countinghouse dependency. Newline-delimited
// JSON-RPC 2.0 on stdin and stdout; nothing else is written to stdout.
//
//   node mcp/server.js [--home <dir>]
const readline = require('node:readline');
const {report} = require('../lib/report');
const {formatText} = require('../lib/format');
const {home} = require('../lib/home');
const {version} = require('../package.json');

const PROTOCOL = '2026-07-28';
const SUPPORTED = new Set([PROTOCOL, '2025-11-25', '2025-06-18', '2025-03-26']);

const TOOL = {
  name: 'usage_report',
  title: 'Usage report',
  description: 'Reports what the countinghouse packs read and returned on this machine: tool calls, the server calls each stood for, and the exact lines and bytes read from servers and returned to the model, per tool, server and launcher process, with token columns estimated as UTF-8 bytes / 4 and labelled so. Read from the local usage records; nothing leaves the machine. Optional since and until (YYYY-MM-DD, inclusive).',
  inputSchema: {
    type: 'object',
    properties: {
      since: {type: 'string', pattern: '^\\d{4}-\\d\\d-\\d\\d$', description: 'first day, YYYY-MM-DD'},
      until: {type: 'string', pattern: '^\\d{4}-\\d\\d-\\d\\d$', description: 'last day, YYYY-MM-DD'}
    },
    additionalProperties: false
  }
};

const USAGE = 'usage: ch-report-mcp [--home <dir>]\n';

// -> the home directory, or throws on a --home with no value or another option.
function homeArg(argv) {
  if (argv.length === 0) return home();
  if (argv[0] !== '--home' || argv.length > 2) throw new Error(`unknown option ${argv.find((a) => a !== '--home') || argv[0]}`);
  if (argv[1] === undefined || argv[1].startsWith('--')) throw new Error('--home needs a value');
  return argv[1];
}

// One JSON-RPC message -> its response, or null for a notification.
function handle(msg, dir) {
  if (msg === null || typeof msg !== 'object' || Array.isArray(msg)) {
    return {jsonrpc: '2.0', id: null, error: {code: -32600, message: 'invalid request: one JSON-RPC request object per line'}};
  }
  const id = msg.id;
  if (id === undefined || id === null) return null;
  const ok = (result) => ({jsonrpc: '2.0', id, result});
  switch (msg.method) {
    case 'initialize': {
      const asked = msg.params && msg.params.protocolVersion;
      return ok({protocolVersion: SUPPORTED.has(asked) ? asked : PROTOCOL, capabilities: {tools: {}}, serverInfo: {name: 'ch-report', version}});
    }
    case 'ping':
      return ok({});
    case 'tools/list':
      return ok({tools: [TOOL]});
    case 'tools/call': {
      const params = msg.params || {};
      if (params.name !== TOOL.name) return {jsonrpc: '2.0', id, error: {code: -32602, message: `unknown tool ${params.name}`}};
      try {
        const agg = report(dir, params.arguments || {});
        return ok({content: [{type: 'text', text: formatText(agg)}], structuredContent: agg});
      } catch (err) {
        return ok({content: [{type: 'text', text: err.message}], isError: true});
      }
    }
    default:
      return {jsonrpc: '2.0', id, error: {code: -32601, message: `method not found: ${msg.method}`}};
  }
}

function serve(input, output, dir) {
  const rl = readline.createInterface({input, crlfDelay: Infinity});
  rl.on('line', (line) => {
    if (line.trim() === '') return;
    let msg;
    try { msg = JSON.parse(line); } catch {
      output.write(JSON.stringify({jsonrpc: '2.0', id: null, error: {code: -32700, message: 'parse error'}}) + '\n');
      return;
    }
    const response = handle(msg, dir);
    if (response) output.write(JSON.stringify(response) + '\n');
  });
}

if (require.main === module) {
  let dir;
  try {
    dir = homeArg(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`ch-report-mcp: ${err.message}\n${USAGE}`);
    process.exit(1);
  }
  serve(process.stdin, process.stdout, dir);
}

module.exports = {handle, TOOL};
