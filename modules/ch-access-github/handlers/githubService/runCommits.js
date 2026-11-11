'use strict';
// ch-access-github/githubService.runCommits: {repo, commit} -> {commit,
// authorLogin}: the GitHub login of the commit's author, never a name or email.
const {request} = require('../../lib/remote');
const {parseRepo, isSha, invalid} = require('../../lib/input');

module.exports = async (input, ctx) => {
  const where = parseRepo(input != null ? input.repo : null);
  if (where == null) throw invalid('repo must be "owner/name"');
  if (!isSha(input.commit)) throw invalid('commit must be a full 40-character commit SHA');
  const {error, body} = await request(ctx, 'runCommits', {...where, sha: input.commit, perPage: 1});
  if (error != null) throw ctx.error('REMOTE_FAILED', `GitHub's server could not read commit ${input.commit}`, {serverText: error});
  const first = Array.isArray(body) ? body[0] : null;
  if (first == null || first.sha !== input.commit) throw ctx.error('COMMIT_NOT_FOUND', `commit ${input.commit} is not in ${input.repo}`);
  const login = first.author != null && typeof first.author.login === 'string' ? first.author.login : null;
  return {output: {commit: first.sha, authorLogin: login}};
};
