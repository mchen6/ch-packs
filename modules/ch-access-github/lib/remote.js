'use strict';
// The one place this module names GitHub's MCP tools: a rename on the server
// is one entry here. Recorded 2026-11-11 (test/fixtures/mcp-results).
//
// The one assumption about RC1-min (not landed yet): ctx.call on a remote,
// `remote:<name>/<tool>`, resolves to the MCP CallToolResult as the server
// sent it, `{content: [{type: 'text', text}], isError?}`.
const REMOTE = 'github';

const TOOLS = {
  listRuns: {tool: 'actions_list', method: 'list_workflow_runs'},
  failedJobs: {tool: 'actions_list', method: 'list_workflow_jobs'},
  jobLog: {tool: 'get_job_logs'},
  runCommits: {tool: 'list_commits'}
};

const textsOf = (result) => (Array.isArray(result && result.content) ? result.content : [])
  .filter((c) => c != null && c.type === 'text' && typeof c.text === 'string')
  .map((c) => c.text);

// One of our actions on the server -> {error: string} when the tool answered
// with an error, else {body}: the JSON its text carries.
async function request(ctx, action, args) {
  const {tool, method} = TOOLS[action];
  const result = await ctx.call(`remote:${REMOTE}/${tool}`, method != null ? {method, ...args} : args);
  const texts = textsOf(result);
  if (result != null && result.isError === true) return {error: texts.join('\n')};
  // The answer is the first text part; a note after it is not part of it.
  try {
    return {body: JSON.parse(texts[0])};
  } catch {
    throw ctx.error('REMOTE_ANSWER_INVALID', `GitHub's server answered ${action} with something that is not JSON`);
  }
}

// GitHub's 410 Gone (past retention) and 404 Not Found reach us only as the
// server's error text, in both forms: the isError text of a job_id call, and
// a failed job's logs[].error in a run_id call.
const expiryOf = (text) => typeof text === 'string' && /unexpected status code: (?:410|404)\b/.test(text);

module.exports = {TOOLS, request, expiryOf};
