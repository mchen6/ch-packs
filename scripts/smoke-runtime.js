#!/usr/bin/env node
'use strict';
// node scripts/smoke-runtime.js
//
// The runtime smoke test (plan Task 1, business review point 3): starts the
// installed countinghouse in local mode's shape (--workerThread --moduleSandbox
// enforce) with one fixture module, calls its tool over MCP with a key of its
// own, checks the answer and stops the server. Proves on each operating system
// that the pinned runtime installs, starts and serves a sandboxed module.
//
// Environment:
//   SMOKE_REDIS_URL        --redisUrl for the runtime (CI's Redis service). Unset:
//                          the runtime's own default.
//   SMOKE_EXPECT_NO_REDIS  "1" on runners with no Redis (macOS, Windows) until
//                          LM1's in-process metering lands: the server must start
//                          and list the tool, and the call is expected to fail.
//                          A call that succeeds there fails the smoke test, so the
//                          marker is removed in the PR that bumps the runtime.
//   SMOKE_PORT             the port; default the first free one in 9700-9719.
//
// Nothing secret is printed: the key is random, lives in a temporary auth.json
// and is never written to stdout or stderr; the server's own output is kept and
// shown only on failure, and countinghouse never logs a key.
const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const {spawn} = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const FRAMEWORK = require.resolve('countinghouse/framework.js', {paths: [ROOT]});
const MODULE = path.join(__dirname, 'test', 'fixtures', 'hello-module');
const PORTS = [9700, 9719];
const START_TIMEOUT_MS = 90 * 1000;
const PROTOCOL = '2026-07-28';

function portFree(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.listen(port, '127.0.0.1', () => s.close(() => resolve(true)));
  });
}

async function choosePort() {
  if (process.env.SMOKE_PORT) return Number(process.env.SMOKE_PORT);
  for (let p = PORTS[0]; p <= PORTS[1]; p++) if (await portFree(p)) return p;
  throw new Error(`no free port in ${PORTS[0]}-${PORTS[1]}`);
}

async function rpc(port, key, method, params) {
  const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream', 'X-CH-Key': key, 'MCP-Protocol-Version': PROTOCOL},
    body: JSON.stringify({jsonrpc: '2.0', id: 1, method, params}),
    signal: AbortSignal.timeout(30 * 1000)
  });
  return res.json();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const expectNoRedis = process.env.SMOKE_EXPECT_NO_REDIS === '1';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ch-smoke-'));
  const key = 'smoke-' + crypto.randomBytes(16).toString('hex');
  fs.writeFileSync(path.join(dir, 'auth.json'), JSON.stringify({[key]: {userName: 'smoke', devices: ['*']}}, null, 2));
  const port = await choosePort();
  const args = [FRAMEWORK, '--workerThread', '--moduleSandbox', 'enforce', '--loadModule', MODULE,
    '--bindAddr', '127.0.0.1', '--port', String(port),
    '--authConfigPath', path.join(dir, 'auth.json'), '--moduleDataPath', path.join(dir, 'module_data')];
  if (process.env.SMOKE_REDIS_URL) args.push('--redisUrl', process.env.SMOKE_REDIS_URL);

  const child = spawn(process.execPath, args, {cwd: dir, stdio: ['ignore', 'pipe', 'pipe']});
  let output = '';
  child.stdout.on('data', (d) => { output += d; });
  child.stderr.on('data', (d) => { output += d; });
  let exited = null;
  child.on('exit', (code, signal) => { exited = {code, signal}; });

  const say = (line) => process.stdout.write(`smoke: ${line}\n`);
  try {
    say(`countinghouse ${require(path.join(path.dirname(FRAMEWORK), 'package.json')).version} on Node ${process.version} (${process.platform}-${process.arch}), port ${port}${expectNoRedis ? ', no Redis expected' : ''}`);

    // 1. Started, the module loaded, its tool listed.
    const deadline = Date.now() + START_TIMEOUT_MS;
    let tool = null;
    while (tool == null) {
      if (exited) throw new Error(`the server exited (${exited.code ?? exited.signal}) before listing the tool`);
      if (Date.now() > deadline) throw new Error(`the tool was not listed within ${START_TIMEOUT_MS / 1000} s`);
      try {
        const list = await rpc(port, key, 'tools/list', {});
        tool = ((list.result && list.result.tools) || []).find((t) => /hello/.test(t.name)) || null;
      } catch { /* not listening yet */ }
      if (tool == null) await sleep(500);
    }
    say(`listed ${tool.name}`);

    // 2. The call.
    const called = await rpc(port, key, 'tools/call', {name: tool.name, arguments: {}});
    const answer = called.result && !called.result.isError ? called.result.structuredContent : null;
    const ok = answer != null && answer.text === 'hello';
    if (expectNoRedis) {
      if (ok) throw new Error('the call succeeded on a runner marked SMOKE_EXPECT_NO_REDIS: remove the marker from ci.yml');
      say('the call failed as expected with no Redis (until LM1)');
    } else {
      if (!ok) throw new Error(`unexpected answer: ${JSON.stringify(called)}`);
      say('the call answered {text: "hello"}');
    }
    say('pass');
    return 0;
  } catch (err) {
    process.stderr.write(`smoke: FAIL: ${err.message}\n--- server output ---\n${output}\n`);
    return 1;
  } finally {
    if (!exited) {
      child.kill();
      await new Promise((r) => (exited ? r() : child.once('exit', r)));
    }
    fs.rmSync(dir, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
  }
}

main().then((code) => { process.exitCode = code; });
