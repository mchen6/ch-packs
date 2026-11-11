'use strict';
// ch-access-github/githubService.listRuns: {repo, branch?, limit} -> {runs}.
const {request} = require('../../lib/remote');
const {parseRepo, invalid} = require('../../lib/input');

module.exports = async (input, ctx) => {
  const where = parseRepo(input != null ? input.repo : null);
  if (where == null) throw invalid('repo must be "owner/name"');
  const {branch, limit} = input;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw invalid('limit must be an integer from 1 to 100');
  if (branch !== undefined && (typeof branch !== 'string' || branch === '')) throw invalid('branch, when given, must be a branch name');
  const {error, body} = await request(ctx, 'listRuns', {...where, perPage: limit, ...(branch !== undefined ? {workflow_runs_filter: {branch}} : {})});
  if (error != null) throw ctx.error('REMOTE_FAILED', `GitHub's server could not list the runs of ${input.repo}`, {serverText: error});
  if (body == null || !Array.isArray(body.workflow_runs)) throw ctx.error('REMOTE_ANSWER_INVALID', `GitHub's server answered the runs of ${input.repo} without a runs list`);
  // Only these fields leave: head_commit (names and emails) never does.
  const runs = body.workflow_runs.map((r) => ({
    runId: String(r.id),
    conclusion: r.conclusion != null ? r.conclusion : null, // null while the run is in progress
    commit: r.head_sha,
    branch: r.head_branch,
    createdAt: r.created_at,
    workflow: r.name,
    url: r.html_url
  }));
  return {output: {runs}};
};
