'use strict';
// Masks secrets and personal data in text lines before any of them can reach a
// result. A pure function of its input: no disk, no network, no state.
//
// Starts from countinghouse's examples/log-triage pii-redact (its e-mail masker
// and its bearer, card, IPv4 and phone patterns, unchanged in what they match)
// and adds the secrets a CI log carries: GitHub tokens, AWS access key ids,
// private key blocks, JWTs and credentials in URLs.
//
// Order is load-bearing, as in the example: secrets first, so the e-mail and
// digit patterns never see inside one (a URL password "pw@example.com" must be
// masked as a credential, not half-masked as an address); card before phone.
// A match is replaced whole by its tag, so no prefix or length leaks.
//
// Every pattern is linear on hostile input: lengths are bounded where a
// pattern could otherwise scan to the end of the line from many starts, and a
// private key block is found with a single forward scan, never [\s\S]*?.

const TYPES = ['bearerToken', 'githubToken', 'awsKey', 'privateKey', 'jwt', 'basicAuthUrl', 'email', 'ipv4', 'card', 'phone'];

const EMAIL = '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}';

// The example's e-mail masker: its lookbehind lets a match start only at the
// beginning of a run of local-part characters (linear on a long run with no
// @); a sticky copy without the lookbehind takes a match starting exactly
// where the previous one ended (a@b.com_c@d.org).
function maskEmails(line, tag) {
  const search = new RegExp(`(?<![A-Za-z0-9._%+-])${EMAIL}`, 'g');
  const resume = new RegExp(EMAIL, 'y');
  let out = '';
  let n = 0;
  let pos = 0;
  for (;;) {
    resume.lastIndex = pos;
    let m = resume.exec(line);
    if (m === null) {
      search.lastIndex = pos;
      m = search.exec(line);
      if (m === null) break;
    }
    out += line.slice(pos, m.index) + tag;
    pos = m.index + m[0].length;
    n++;
  }
  return {text: out + line.slice(pos), n};
}

// Applied in this order, to every line, after private key blocks are gone.
const PATTERNS = [
  {type: 'jwt', tag: '<jwt>', re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g},
  {type: 'githubToken', tag: '<githubToken>', re: /\b(?:gh[oprsu]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})/g},
  {type: 'awsKey', tag: '<awsKey>', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g},
  {type: 'bearerToken', tag: '<token>', re: /\bbearer\s+[A-Za-z0-9._~+/-]{16,}=*/gi},
  {type: 'basicAuthUrl', tag: '://<basicAuth>@', re: /:\/\/[^/:@\s]{1,256}:[^@\s]{1,256}@/g},
  {type: 'email', tag: '<email>', mask: maskEmails},
  {type: 'card', tag: '<card>', re: /\b(?:\d[ -]?){12,18}\d\b/g},
  {type: 'ipv4', tag: '<ipv4>', re: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g},
  {type: 'phone', tag: '<phone>', re: /(?:\+\d{1,3}[-. ]?)?(?:\(\d{3}\)|\d{3})[-. ]\d{3}[-. ]\d{4}\b/g}
];

const KEY_BEGIN = /-----BEGIN [A-Z0-9 ]{0,40}PRIVATE KEY-----/g;
const KEY_END = /-----END [A-Z0-9 ]{0,40}PRIVATE KEY-----/g;
const KEY_TAG = '<privateKey>';

// Private key blocks, within a line or across lines, each replaced by one tag;
// a block's inner lines are dropped, so three lines in are one line out. A
// block with no end masks everything after its start.
function maskKeyBlocks(lines, counts) {
  const out = [];
  let inside = false; // within a block opened on an earlier line
  for (const line of lines) {
    let text = '';
    let pos = 0;
    if (inside) {
      KEY_END.lastIndex = 0;
      const end = KEY_END.exec(line);
      if (end === null) continue; // an inner line: dropped
      inside = false;
      pos = end.index + end[0].length;
      text = out.pop(); // the block's tag line takes the rest of this one
    }
    for (;;) {
      KEY_BEGIN.lastIndex = pos;
      const begin = KEY_BEGIN.exec(line);
      if (begin === null) break;
      counts.privateKey++;
      text += line.slice(pos, begin.index) + KEY_TAG;
      KEY_END.lastIndex = begin.index + begin[0].length;
      const end = KEY_END.exec(line);
      if (end === null) {
        inside = true;
        pos = line.length;
        break;
      }
      pos = end.index + end[0].length;
    }
    out.push(text + line.slice(pos));
  }
  return out;
}

// -> {lines, counts}: the lines with every match replaced by its tag, and how
// many matches of each type were replaced. A zero count is not evidence that
// the text holds no secret or personal data: the patterns are what they are.
function redactLines(lines) {
  const counts = Object.fromEntries(TYPES.map((t) => [t, 0]));
  const masked = maskKeyBlocks(lines, counts).map((line) => {
    let out = line;
    for (const p of PATTERNS) {
      if (p.mask) {
        const r = p.mask(out, p.tag);
        out = r.text;
        counts[p.type] += r.n;
      } else {
        out = out.replace(p.re, () => { counts[p.type]++; return p.tag; });
      }
    }
    return out;
  });
  return {lines: masked, counts};
}

module.exports = {redactLines, TYPES};
