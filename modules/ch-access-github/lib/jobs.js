'use strict';
// A run's failed jobs, every page of them.
const {request} = require('./remote');

const FAILED = new Set(['failure', 'timed_out']);
const MAX_PAGES = 10; // 1,000 jobs at 100 a page; GitHub's matrix limit is 256

async function collectFailedJobs(ctx, {owner, repo, runId}, perPage) {
  const all = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const {error, body} = await request(ctx, 'failedJobs', {owner, repo, resource_id: runId, perPage, page});
    if (error != null) throw ctx.error('REMOTE_FAILED', `GitHub's server could not list the jobs of run ${runId}`, {serverText: error});
    // The server nests the list: {jobs: {total_count, jobs: [...]}}.
    const list = body != null && body.jobs != null && Array.isArray(body.jobs.jobs) ? body.jobs.jobs : null;
    if (list == null) throw ctx.error('REMOTE_ANSWER_INVALID', `GitHub's server answered the jobs of run ${runId} without a jobs list`);
    all.push(...list);
    if (list.length === 0 || !(all.length < body.jobs.total_count)) break;
  }
  return all
    .filter((j) => j != null && FAILED.has(j.conclusion))
    .map((j) => ({
      jobId: String(j.id),
      name: j.name,
      conclusion: j.conclusion,
      steps: (Array.isArray(j.steps) ? j.steps : []).map((s) => ({name: s.name, conclusion: s.conclusion}))
    }));
}

module.exports = {collectFailedJobs};
