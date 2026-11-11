'use strict';
// ch-step-report/reportService.assemble: {run, errors, history, ownerHint,
// coverage} -> the result with its summary, in a fixed field order.
const {assembleReport} = require('../../lib/report');

const INPUT = ['run', 'errors', 'history', 'ownerHint', 'coverage'];
const VERDICTS = ['new', 'flaky', 'recurring'];
const isObject = (x) => x != null && typeof x === 'object' && !Array.isArray(x);
const isSeen = (s) => isObject(s) && typeof s.commit === 'string';
const isHistory = (h) => h === null || (isObject(h) && Number.isInteger(h.count) && h.count >= 1 && Number.isInteger(h.window) && h.window >= 1
  && VERDICTS.includes(h.verdict) && isSeen(h.firstSeen) && isSeen(h.lastSeen));

module.exports = async (input) => {
  const ok = isObject(input) && Object.keys(input).every((k) => INPUT.includes(k))
    && isObject(input.run) && (input.run.step === null || typeof input.run.step === 'string')
    && Array.isArray(input.errors) && input.errors.every((e) => typeof e === 'string')
    && isHistory(input.history)
    && (input.ownerHint === null || (isObject(input.ownerHint) && Array.isArray(input.ownerHint.logins) && Array.isArray(input.ownerHint.why)))
    && isObject(input.coverage);
  if (!ok) throw new DeviceError('ARGUMENTS_INVALID', 'expected {run, errors: string[], history|null, ownerHint|null, coverage} in the triage result\'s shapes');
  return {output: assembleReport(input)};
};
