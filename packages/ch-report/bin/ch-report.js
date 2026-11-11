#!/usr/bin/env node
'use strict';
// ch-report [--since <YYYY-MM-DD>] [--until <YYYY-MM-DD>] [--json|--csv] [--home <dir>]
//
// The layer-1 usage report from the runtime's own records, on the command line:
// reading it costs no tokens, and the export can be handed to someone else.
const {report} = require('../lib/report');
const {formatText, formatCsv} = require('../lib/format');
const {home} = require('../lib/home');

const USAGE = 'usage: ch-report [--since <YYYY-MM-DD>] [--until <YYYY-MM-DD>] [--json|--csv] [--home <dir>]\n';
const VALUED = ['--since', '--until', '--home'];
const FLAGS = ['--json', '--csv'];

function parse(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (VALUED.includes(a)) {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) throw new Error(`${a} needs a value`);
      opts[a.slice(2)] = v;
    } else if (FLAGS.includes(a)) {
      opts[a.slice(2)] = true;
    } else {
      throw new Error(`unknown option ${a}`);
    }
  }
  if (opts.json && opts.csv) throw new Error('--json and --csv are one or the other');
  return opts;
}

function main(argv, io = process) {
  let opts;
  let agg;
  try {
    opts = parse(argv);
    agg = report(opts.home || home(), {since: opts.since, until: opts.until});
  } catch (err) {
    io.stderr.write(`ch-report: ${err.message}\n${USAGE}`);
    return 1;
  }
  io.stdout.write(opts.json ? JSON.stringify(agg, null, 2) + '\n' : opts.csv ? formatCsv(agg) : formatText(agg));
  return 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = {main};
