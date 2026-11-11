'use strict';
// ch-access-github/githubService.jobLog: {repo, jobId} -> {text, lines, bytes,
// expired, truncated}. A log past retention or gone is expired, not an error.
const {request, expiryOf} = require('../../lib/remote');
const {parseRepo, isId, invalid} = require('../../lib/input');

// The server's default is the last 500 lines; ask for the whole log.
const TAIL_LINES = 200000;

const lineCount = (text) => (text === '' ? 0 : text.split('\n').length - (text.endsWith('\n') ? 1 : 0));

module.exports = async (input, ctx) => {
  const where = parseRepo(input != null ? input.repo : null);
  if (where == null) throw invalid('repo must be "owner/name"');
  if (!isId(input.jobId)) throw invalid('jobId must be a job id, as digits');
  const {error, body} = await request(ctx, 'jobLog', {...where, job_id: Number(input.jobId), return_content: true, tail_lines: TAIL_LINES});
  if (error != null) {
    if (expiryOf(error)) return {output: {text: '', lines: 0, bytes: 0, expired: true, truncated: false}};
    throw ctx.error('LOG_UNAVAILABLE', `the log of job ${input.jobId} is unavailable`, {serverText: error});
  }
  if (body == null || typeof body.logs_content !== 'string') throw ctx.error('REMOTE_ANSWER_INVALID', `GitHub's server answered the log of job ${input.jobId} without its content`);
  const text = body.logs_content;
  const lines = lineCount(text);
  // Without original_length, a log that fills the requested tail may be cut.
  const truncated = Number.isInteger(body.original_length) ? body.original_length > lines : lines >= TAIL_LINES;
  return {output: {text, lines, bytes: Buffer.byteLength(text, 'utf8'), expired: false, truncated}};
};
