'use strict';
// One report from arguments: what the command line and the MCP tool share.
const {readUsage, DATE} = require('./read');
const {aggregate} = require('./aggregate');

const ARGUMENTS = ['since', 'until'];

// A real day: Date.UTC would roll 2026-02-30 over to March 2.
function isDay(s) {
  if (typeof s !== 'string' || !DATE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  return m >= 1 && m <= 12 && d >= 1 && d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// {since?, until?} -> aggregate; throws an Error with a plain message on an
// unknown argument, a day that does not exist, or since after until.
function report(home, args = {}) {
  for (const k of Object.keys(args)) if (!ARGUMENTS.includes(k)) throw new Error(`unknown argument ${k}: only since and until`);
  const {since, until} = args;
  for (const [name, value] of [['since', since], ['until', until]]) {
    if (value !== undefined && !isDay(value)) throw new Error(`${name} must be a day that exists, YYYY-MM-DD`);
  }
  if (since !== undefined && until !== undefined && since > until) throw new Error(`since (${since}) comes after until (${until})`);
  return aggregate(readUsage(home, {since, until}));
}

module.exports = {report};
