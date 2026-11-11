'use strict';
// The runtime's usage records, read from <home>/usage/<YYYY-MM-DD>/<pid>-<startMs>.jsonl:
// one append-only file per launcher process, one JSON record per line. Reading
// needs no running runtime and no port, and changes nothing.
const fs = require('node:fs');
const path = require('node:path');

const DATE = /^\d{4}-\d\d-\d\d$/;
const FILE = /^(\d+)-(\d+)\.jsonl$/;
const NUMBERS = ['bytesIn', 'linesIn', 'bytesOut', 'linesOut'];

const isRecord = (r) => r != null && typeof r === 'object' && typeof r.t === 'string'
  && typeof r.pack === 'string' && typeof r.tool === 'string' && (r.server === null || typeof r.server === 'string')
  && NUMBERS.every((k) => Number.isInteger(r[k]) && r[k] >= 0);

const list = (dir) => {
  try { return fs.readdirSync(dir).sort(); } catch { return []; }
};

// -> records, oldest file first, each with `process` (its file's
// "<pid>-<startMs>"). since/until are YYYY-MM-DD, inclusive, on the record's
// own time (UTC). A line that is not a whole record (the truncated last line a
// process stopped mid-write leaves) is skipped.
function readUsage(home, {since, until} = {}) {
  const usage = path.join(home, 'usage');
  const records = [];
  for (const day of list(usage).filter((d) => DATE.test(d) && (until === undefined || d <= until))) {
    for (const file of list(path.join(usage, day)).filter((f) => FILE.test(f))) {
      let text;
      try { text = fs.readFileSync(path.join(usage, day, file), 'utf8'); } catch { continue; }
      for (const line of text.split('\n')) {
        if (line.trim() === '') continue;
        let r;
        try { r = JSON.parse(line); } catch { continue; }
        if (!isRecord(r)) continue;
        const date = r.t.slice(0, 10);
        if ((since !== undefined && date < since) || (until !== undefined && date > until)) continue;
        records.push({...r, process: file.slice(0, -'.jsonl'.length)});
      }
    }
  }
  return records;
}

module.exports = {readUsage, DATE};
