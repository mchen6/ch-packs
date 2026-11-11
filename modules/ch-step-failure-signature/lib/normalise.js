'use strict';
// A stable fingerprint for one failed job: the failing step and its error
// lines with what changes from run to run generalised away. A pure function.
//
// Normalisation, in this order (each later rule sees the earlier ones' marks):
//   ISO dates and times, and bare hh:mm:ss times  -> T
//   durations: 2.1ms, 3s, 2m                      -> D
//   absolute paths, POSIX or Windows              -> P/<basename>
//   quoted strings longer than 40 characters      -> "…"
//   hex: 0x… and runs of 7+ hex digits holding both a digit and a letter
//        (commit SHAs, addresses; "defaced" is a word, "1066192" a number) -> H
//   numbers not glued to a letter (TS2304 keeps its code)               -> #
//   whitespace collapsed, ends trimmed.
const crypto = require('node:crypto');

const RULES = [
  [/\d{4}-\d\d-\d\d(?:[T ]\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:?\d\d)?)?/g, 'T'],
  [/\b\d\d:\d\d:\d\d(?:\.\d+)?\b/g, 'T'],
  [/(?<![A-Za-z_\d.])\d+(?:\.\d+)?(?:ms|s|m)\b/g, 'D'],
  [/(?<![\w.~/:])\/(?:[\w.@+-]+\/)+([\w.@+-]*)/g, 'P/$1'],
  [/\b[A-Za-z]:\\(?:[^\\\s'"]+\\)+([^\\\s'":]*)/g, 'P/$1'],
  [/"[^"]{41,}"|'[^']{41,}'/g, '"…"'],
  [/\b0x[0-9a-fA-F]+\b/g, 'H'],
  [/\b(?=[0-9a-fA-F]*\d)(?=[0-9a-fA-F]*[a-fA-F])[0-9a-fA-F]{7,}\b/g, 'H'],
  [/(?<![A-Za-z_\d.])\d+(?:\.\d+)*/g, '#'],
  [/\s+/g, ' ']
];

const SIGNED = new Set(['error', 'assert', 'stack', 'exit']);

function normaliseLine(text) {
  return RULES.reduce((s, [re, to]) => s.replace(re, to), text).trim();
}

// The lines that go into a signature: all but the tail.
const signedLines = (lines) => lines.filter((l) => SIGNED.has(l.kind)).map((l) => normaliseLine(l.text));

// -> sha256 hex of the step (empty for none) and the normalised signed lines,
// one per line.
function signatureOf(step, lines) {
  return crypto.createHash('sha256').update([step == null ? '' : step, ...signedLines(lines)].join('\n')).digest('hex');
}

module.exports = {normaliseLine, signatureOf, signedLines, KINDS: ['error', 'assert', 'stack', 'exit', 'tail']};
