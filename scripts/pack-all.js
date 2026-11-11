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
  return i === -1 ? fallback : argv[i + 1];
}

function fail(message) {
  process.stderr.write(`pack-all: ${message}\n`);
  return 1;
}

function main(argv) {
  const root = path.resolve(option(argv, '--root', path.join(__dirname, '..')));
  const out = path.resolve(option(argv, '--out', path.join(root, 'dist')));

  fs.mkdirSync(out, {recursive: true});
  const packed = npm(['pack', '--workspaces', '--json', '--pack-destination', out], {cwd: root});
  if (packed.status !== 0) {
    // npm's answer for a root whose workspace globs match nothing yet.
    if (/No workspaces found/.test(packed.stdout + packed.stderr)) {
      process.stdout.write('[]\n');
      return 0;
    }
    return fail(`npm pack failed:\n${packed.stderr}`);
  }
  const list = JSON.parse(packed.stdout).map((e) => {
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
