# ch-packs

The family repository of the countinghouse client packs: composite MCP tools
for Claude Code, Cursor, VS Code, Codex and Claude Desktop, run on this
machine by [countinghouse](https://github.com/mchen6/countinghouse). The
first pack answers "why did CI fail?" from GitHub Actions logs, with a
receipt of what was read and what was returned.

## What is here

- The design: [docs/superpowers/specs/2026-11-11-client-packs-design.md](docs/superpowers/specs/2026-11-11-client-packs-design.md)
- The plan: [docs/superpowers/plans/2026-11-11-ch-packs-v1.md](docs/superpowers/plans/2026-11-11-ch-packs-v1.md)
- The cross-package acceptance tests (plan Task 13), which install every
  package from its own repository's tarball on Linux, macOS and Windows:
  not written yet.

No package lives here, and nothing is published from here
([docs/publishing.md](docs/publishing.md)).

## Where each package lives

Each package has its own repository under `mchen6` (Matt, 2026-11-11) and is
published to npm as `@countinghouse/<name>`.

| Package | Repository | What it is |
|---|---|---|
| `ch-local` | https://github.com/mchen6/ch-local | the launcher, the client snippets, the Claude Code plugin and its marketplace, the install pages |
| `ch-access-github` | https://github.com/mchen6/ch-access-github | the GitHub access module, over GitHub's MCP server |
| `ch-pack-ci-failure-triage` | https://github.com/mchen6/ch-pack-ci-failure-triage | the first pack's scenario module (the repository is being created) |
| `ch-report` | https://github.com/mchen6/ch-report | the usage report, on the command line and as an MCP tool |
| `ch-step-redact` | https://github.com/mchen6/ch-step-redact | step: masks secrets and personal data |
| `ch-step-log-clean` | https://github.com/mchen6/ch-step-log-clean | step: cleans a CI log into lines and steps |
| `ch-step-error-patterns` | https://github.com/mchen6/ch-step-error-patterns | step: finds the failing step and its error lines |
| `ch-step-failure-signature` | https://github.com/mchen6/ch-step-failure-signature | step: a stable signature for a failure |
| `ch-step-dedupe` | https://github.com/mchen6/ch-step-dedupe | step: groups failures, new, flaky or recurring |
| `ch-step-owner-hint` | https://github.com/mchen6/ch-step-owner-hint | step: who last touched the failing code, as logins |
| `ch-step-report` | https://github.com/mchen6/ch-step-report | step: assembles the answer and its receipt |

## Development

```
npm test   # checks this repository's own shape
```

Apache-2.0.
