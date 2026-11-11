#!/usr/bin/env node
'use strict';
// node scripts/pack-all.js [--root <dir>] [--out <dir>]
//
// Packs every workspace of <root> (default: this repository) into <out>
// (default: <root>/dist) and prints one JSON array on stdout:
// [{name, version, file, integrity}], `file` the tarball's name inside <out>,
// `integrity` the sha512 of the tarball's bytes, in npm's "sha512-<base64>"
// form. The tarball install (`ch-local install --from <out>`) checks against it.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {npm} = require('./lib/npm');

function option(argv, name, fallback) {
  const i = argv.indexOf(name);
  if (i === -1) return fallback;
  const value = argv[i + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`${name} needs a value`);
  return value;
}

// npm prints what workspace scripts (prepack, prepare, postpack) write on the
// same stdout, before its JSON: the JSON is the last top-level array.
function lastJsonArray(stdout) {
  const starts = stdout.startsWith('[') ? [0] : [];
  for (let i = stdout.indexOf('\n['); i !== -1; i = stdout.indexOf('\n[', i + 1)) starts.push(i + 1);
  for (const start of starts.reverse()) {
    try { return JSON.parse(stdout.slice(start)); } catch { /* script output that starts with "[" */ }
  }
  throw new Error('npm pack printed no JSON list');
}

function fail(message) {
  process.stderr.write(`pack-all: ${message}\n`);
  return 1;
}

function main(argv) {
  let root;
  let out;
  try {
    root = path.resolve(option(argv, '--root', path.join(__dirname, '..')));
    out = path.resolve(option(argv, '--out', path.join(root, 'dist')));
  } catch (err) {
    return fail(err.message);
  }

  fs.mkdirSync(out, {recursive: true});
  const packed = npm(['pack', '--workspaces', '--json', '--pack-destination', out], {cwd: root});
  if (packed.status !== 0) {
    // npm's answer for a root whose workspace globs match nothing yet.
    if (/No workspaces found/.test(packed.stdout + packed.stderr)) {
      process.stdout.write('[]\n');
      return 0;
    }
    return fail(`npm pack failed${packed.error ? ` (${packed.error.code || packed.error.message})` : ''}:\n${packed.stderr}`);
  }
  let entries;
  try {
    entries = lastJsonArray(packed.stdout);
  } catch (err) {
    return fail(err.message);
  }
  const list = entries.map((e) => {
    const bytes = fs.readFileSync(path.join(out, e.filename));
    return {
      name: e.name,
      version: e.version,
      file: e.filename,
      integrity: 'sha512-' + crypto.createHash('sha512').update(bytes).digest('base64')
    };
  });
  process.stdout.write(JSON.stringify(list, null, 2) + '\n');
  return 0;
}

process.exitCode = main(process.argv.slice(2));
