'use strict';
// A fake ctx for handler tests: ctx.call('remote:github/<tool>', args) answers
// from the fixtures recorded from GitHub's MCP server (test/fixtures/mcp-results),
// chosen by tool name, and records every call. No network.
const path = require('node:path');
const {CountinghouseError} = require('countinghouse/lib/countinghouse-error');

const DIR = path.join(__dirname, '..', 'fixtures', 'mcp-results');
const fixture = (name) => require(path.join(DIR, `${name}.json`));

// routes: {<tool>: fixture | (args) => fixture}
function fakeCtx(routes) {
  const calls = [];
  return {
    calls,
    // the runtime's own ctx.error (lib/handler-ctx.js)
    error: (code, message, details) => CountinghouseError.module(code, message, details),
    call: async (address, args) => {
      calls.push({address, args});
      const m = /^remote:github\/(.+)$/.exec(address);
      const route = m != null ? routes[m[1]] : undefined;
      if (route === undefined) throw new Error(`fake ctx: no fixture for ${address}`);
      return (typeof route === 'function' ? route(args) : route).result;
    }
  };
}

// The JSON a fixture's single text content carries.
const body = (name) => JSON.parse(fixture(name).result.content[0].text);

module.exports = {fakeCtx, fixture, body};
