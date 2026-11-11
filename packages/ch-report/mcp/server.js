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

function homeArg(argv) {
  const i = argv.indexOf('--home');
  return i !== -1 && argv[i + 1] ? argv[i + 1] : home();
}

// One JSON-RPC message -> its response, or null for a notification.
function handle(msg, dir) {
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

if (require.main === module) serve(process.stdin, process.stdout, homeArg(process.argv.slice(2)));

module.exports = {handle, TOOL};
