# GitHub MCP server fixtures

Recorded once by hand on 2026-11-11 from GitHub's remote MCP server
(`https://api.githubcopilot.com/mcp/`, header `X-MCP-Toolsets: actions,repos`,
`github-mcp-server/remote-c6a98818`) with a read-only fine-grained PAT, against
`mchen6/countinghouse`. Each file is `{_recorded, request, result}`: the
`tools/call` request sent and the JSON-RPC `result` that came back.

| File | Call | What it shows |
|---|---|---|
| `tools-list.json` | `tools/list` | input schemas of the five tools this module may call |
| `list_workflow_runs.json` | `actions_list` `list_workflow_runs`, `perPage: 50` | the last fifty runs: 45 success, 4 cancelled, 1 failure (run 42775507169) |
| `list_workflow_jobs.json` | `actions_list` `list_workflow_jobs` for run 42775507169 | 4 jobs, 3 failed at step "Run functional tests". The jobs array is nested: `{jobs: {total_count, jobs: [...]}}` |
| `get_job_logs-<jobId>.json` | `get_job_logs`, `return_content: true`, `tail_lines: 200000` | the three failed jobs' logs, `original_length` 1539, 1535, 1533, each equal to the lines returned |
| `list_commits.json` | `list_commits`, `sha` = the failed run's head, `perPage: 1` | a commit with `author.login`; git identities scrubbed |
| `list_workflow_jobs-expired.json` | `list_workflow_jobs` for run 31256649524 (2026-08-08) | a failed run from before the 90-day log retention |
| `get_job_logs-expired.json` | `get_job_logs` for job 93100912193 | expired log: `isError: true`, text `... unexpected status code: 410 Gone` |
| `get_job_logs-expired-run.json` | `get_job_logs` `run_id` + `failed_only: true` | same 410, but as a per-job `error` inside a result that is not `isError` |

## What was removed

- No token, `Authorization` header or session id was recorded. Only response bodies were kept.
- Every email is replaced by `removed@example.invalid`. The `name` of every git identity (`{name, email, ...}`) is replaced by `Example Author`. Logins are kept.
- No log line was kept. Each `logs_content` is a synthetic log of the same line count (`synthetic line N`). The real log survives only as `_recorded.logFingerprint` `{sha256, lines, bytes}`.
