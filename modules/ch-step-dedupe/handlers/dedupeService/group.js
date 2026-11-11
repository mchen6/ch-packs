'use strict';
// ch-step-dedupe/dedupeService.group: {window, runs} -> {groups, latest}.
const {groupFailures} = require('../../lib/group');

const MAX_WINDOW = 100;
const ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/;
const CONCLUSIONS = ['failure', 'success', 'other'];

const isRun = (r) => r != null
  && typeof r.runId === 'string' && r.runId !== ''
  && CONCLUSIONS.includes(r.conclusion)
  && typeof r.commit === 'string' && typeof r.branch === 'string'
  && typeof r.createdAt === 'string' && ISO.test(r.createdAt) && !Number.isNaN(Date.parse(r.createdAt))
  && (r.signature === undefined || (typeof r.signature === 'string' && /^[0-9a-f]{64}$/.test(r.signature)));

module.exports = async (input) => {
  const window = input != null ? input.window : null;
  const runs = input != null ? input.runs : null;
  if (!Number.isInteger(window) || window < 1 || window > MAX_WINDOW) {
    throw new DeviceError('ARGUMENTS_INVALID', `window must be an integer from 1 to ${MAX_WINDOW}`);
  }
  if (!Array.isArray(runs) || !runs.every(isRun)) {
    throw new DeviceError('ARGUMENTS_INVALID', 'runs must be [{runId, conclusion: failure|success|other, commit, branch, createdAt (ISO 8601), signature?: sha256 hex}]');
  }
  return {output: groupFailures(window, runs)};
};
