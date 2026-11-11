'use strict';
// ch-access-github/githubService.failedJobs: {repo, runId} -> {jobs}: the jobs
// that failed or timed out, with every step's name and conclusion.
const {collectFailedJobs} = require('../../lib/jobs');
const {parseRepo, isId, invalid} = require('../../lib/input');

const PER_PAGE = 100;

module.exports = async (input, ctx) => {
  const where = parseRepo(input != null ? input.repo : null);
  if (where == null) throw invalid('repo must be "owner/name"');
  if (!isId(input.runId)) throw invalid('runId must be a run id, as digits');
  return {output: {jobs: await collectFailedJobs(ctx, {...where, runId: input.runId}, PER_PAGE)}};
};
