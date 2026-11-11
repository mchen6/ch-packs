'use strict';
// ch-step-owner-hint/ownerService.hint: {firstSeen, stepCommits} -> {logins, why}.
const {ownerHint, isCommitRef} = require('../../lib/hint');

module.exports = async (input) => {
  const firstSeen = input != null ? input.firstSeen : undefined;
  const stepCommits = input != null ? input.stepCommits : null;
  if (!(firstSeen === null || isCommitRef(firstSeen)) || !Array.isArray(stepCommits) || !stepCommits.every(isCommitRef)) {
    throw new DeviceError('ARGUMENTS_INVALID', 'expected {firstSeen: {commit, authorLogin}|null, stepCommits: [{commit, authorLogin}]}: commits as hex SHAs, authors as GitHub logins or null, never an e-mail address');
  }
  return {output: ownerHint({firstSeen, stepCommits})};
};
