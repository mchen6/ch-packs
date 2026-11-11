#!/usr/bin/env node
'use strict';
// node scripts/validate-modules.js <dir>
//
// Runs countinghouse-validate over every subdirectory of <dir> that holds a
// package.json, one child process each (the validator requires the module, so a
// fresh process keeps one module's require cache from reaching the next). Prints
// every module's result and exits 0 when all are clean, 1 when any has a
// problem, 2 when <dir> cannot be read.
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const VALIDATOR = require.resolve('countinghouse/bin/countinghouse-validate.js', {paths: [path.join(__dirname, '..')]});

function moduleDirs(dir) {
  return fs.readdirSync(dir, {withFileTypes: true})
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(dir, e.name, 'package.json')))
    .map((e) => e.name)
    .sort()
    .map((name) => path.join(dir, name));
}

// How long one module's validation may take before its child is stopped:
// VALIDATE_TIMEOUT_MS, default two minutes.
const TIMEOUT_MS = Number(process.env.VALIDATE_TIMEOUT_MS) > 0 ? Number(process.env.VALIDATE_TIMEOUT_MS) : 120 * 1000;

const unvalidated = (name, why) => ({ok: false, lines: [`${name}: could not be validated: ${why}`]});

// The validator's result for one module -> {ok, lines}.
function describe(name, result) {
  if (result == null) return unvalidated(name, 'the validator gave no result');
  if (result.error != null) return unvalidated(name, result.error);
  const warnings = (result.warnings || []).map((w) => `  warning [${w.stage}] ${w.message}`);
  if (result.ok === true) return {ok: true, lines: [`ok: ${result.module}`, ...warnings]};
  if (!Array.isArray(result.problems) || result.problems.length === 0) {
    return unvalidated(name, 'the validator answered not ok with no problems listed');
  }
  const lines = [`${result.module}: ${result.problems.length} problem(s)`];
  for (const p of result.problems) {
    lines.push(`  [${p.stage}] ${p.message}`);
    if (p.fix != null) lines.push(`      fix: ${p.fix}`);
  }
  return {ok: false, lines: [...lines, ...warnings]};
}

// One module -> {ok, lines}.
function validate(moduleDir) {
  const name = path.basename(moduleDir);
  const r = spawnSync(process.execPath, [VALIDATOR, '--json', moduleDir], {encoding: 'utf8', timeout: TIMEOUT_MS, killSignal: 'SIGKILL'});
  if (r.error && r.error.code === 'ETIMEDOUT') return unvalidated(name, `did not finish within ${Math.round(TIMEOUT_MS / 1000)} s and was stopped`);
  if (r.error) return unvalidated(name, `the validator could not run (${r.error.code || r.error.message})`);
  let result = null;
  for (const line of String(r.stdout).split('\n').reverse()) {
    try { result = JSON.parse(line); break; } catch { /* not the result line */ }
  }
  return describe(name, result);
}

function main(argv) {
  const dir = path.resolve(argv[0] || 'modules');
  let dirs;
  try {
    dirs = moduleDirs(dir);
  } catch (err) {
    process.stderr.write(`validate-modules: cannot read ${dir} (${err.code || err.name})\n`);
    return 2;
  }
  if (dirs.length === 0) {
    process.stdout.write(`no module found in ${dir}\n`);
    return 0;
  }
  const results = dirs.map(validate);
  for (const r of results) process.stdout.write(r.lines.join('\n') + '\n');
  const bad = results.filter((r) => !r.ok).length;
  process.stdout.write(bad === 0
    ? `${dirs.length} module(s), no problems\n`
    : `${bad} of ${dirs.length} module(s) have problems\n`);
  return bad === 0 ? 0 : 1;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = {describe};
