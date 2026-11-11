'use strict';
// One report from arguments: what the command line and the MCP tool share.
const {readUsage, DATE} = require('./read');
const {aggregate} = require('./aggregate');

// {since?, until?} -> aggregate; throws an Error with a plain message on a bad date.
function report(home, {since, until} = {}) {
  for (const [name, value] of [['since', since], ['until', until]]) {
    if (value !== undefined && !(typeof value === 'string' && DATE.test(value))) throw new Error(`${name} must be a date, YYYY-MM-DD`);
  }
  return aggregate(readUsage(home, {since, until}));
}

module.exports = {report};
