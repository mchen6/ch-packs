'use strict';
// ch-step-report/reportService.assemble: {run, errors, history, ownerHint,
// coverage} -> the result with its summary, in a fixed field order.
const {assembleReport} = require('../../lib/report');

const INPUT = ['run', 'errors', 'history', 'ownerHint', 'coverage'];
const VERDICTS = ['new', 'flaky', 'recurring'];
const isObject = (x) => x != null && typeof x === 'object' && !Array.isArray(x);
const isSeen = (s) => isObject(s) && typeof s.commit === 'string';
// GitHub logins only (ch-step-owner-hint's rule): never an e-mail address.
const LOGIN = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}(?:\[bot\])?$/;
const isHistory = (h) => h === null || (isObject(h) && Number.isInteger(h.count) && h.count >= 1 && Number.isInteger(h.window) && h.window >= 1
  && VERDICTS.includes(h.verdict) && isSeen(h.firstSeen) && isSeen(h.lastSeen)
  && Array.isArray(h.runIds) && h.runIds.length === h.count && (h.verdict !== 'new' || h.count === 1));
const isHint = (o) => o === null || (isObject(o) && Array.isArray(o.logins) && Array.isArray(o.why)
  && o.logins.length <= 3 && o.logins.length === o.why.length
  && o.logins.every((l) => typeof l === 'string' && LOGIN.test(l)) && o.why.every((w) => typeof w === 'string'));

module.exports = async (input) => {
  const ok = isObject(input) && Object.keys(input).every((k) => INPUT.includes(k))
    && isObject(input.run) && (input.run.step === null || typeof input.run.step === 'string')
    && Array.isArray(input.errors) && input.errors.every((e) => typeof e === 'string')
    && isHistory(input.history)
    && isHint(input.ownerHint)
    && isObject(input.coverage);
  if (!ok) throw new DeviceError('ARGUMENTS_INVALID', 'expected {run, errors: string[], history|null, ownerHint|null, coverage} in the triage result\'s shapes');
  return {output: assembleReport(input)};
};
