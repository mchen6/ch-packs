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

// One module -> {ok, lines}.
function validate(moduleDir) {
  const r = spawnSync(process.execPath, [VALIDATOR, '--json', moduleDir], {encoding: 'utf8'});
  let result = null;
  for (const line of String(r.stdout).split('\n').reverse()) {
    try { result = JSON.parse(line); break; } catch { /* not the result line */ }
  }
  const name = path.basename(moduleDir);
  if (result == null || result.error != null || !Array.isArray(result.problems || [])) {
    const why = result && result.error ? result.error : `the validator exited ${r.status} with no result`;
    return {ok: false, lines: [`${name}: could not be validated: ${why}`]};
  }
  const warnings = (result.warnings || []).map((w) => `  warning [${w.stage}] ${w.message}`);
  if (result.ok === true) return {ok: true, lines: [`ok: ${result.module}`, ...warnings]};
  const lines = [`${result.module}: ${result.problems.length} problem(s)`];
  for (const p of result.problems) {
    lines.push(`  [${p.stage}] ${p.message}`);
    if (p.fix != null) lines.push(`      fix: ${p.fix}`);
  }
  return {ok: false, lines: [...lines, ...warnings]};
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

process.exitCode = main(process.argv.slice(2));
