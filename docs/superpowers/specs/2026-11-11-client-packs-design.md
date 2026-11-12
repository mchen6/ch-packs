# Client packs: design

Status: APPROVED by Matt 2026-11-11 (~11:15 Pacific), with the business side's notes of 10:10 and 10:30 folded in; open items in section 14. Written for a
builder who has not seen this conversation. Matt's decisions are marked
"(Matt)"; everything else is the tech side's call and can be overruled.

## Intent

A developer installs one thing into the agent they already use (Claude Code,
Cursor, VS Code, Codex, Claude Desktop) and, the next time CI goes red, asks
"why did CI fail?". One tool call answers in seconds with what fifteen minutes
of scrolling would have given: the failing step, the few error lines that
matter, and the history across recent runs (same signature as earlier
failures, how many of the last fifty, first seen at which commit, flaky or
new, likely owner). With the answer comes one measured line: how many log
lines were read across how many runs, and how many reached the model. That
line proves both selling points, data safety and token saving, with the
developer's own numbers on first use (Matt, 2026-11-11).

The pack family is a set of such ready-made composite tools for the eight
scenarios the business side ranked, built on countinghouse, open source
under Apache-2.0 (Matt), usable from several agents and, later, from the
phone.

## Decisions already made (Matt, 2026-11-11 unless noted)

1. Local first, hosted later; build the whole set of packs for the common
   workflows; selling points: data does not enter the model, and saving
   money (00:57).
2. Start now; do not wait for the 12-05 benchmark (00:58).
3. Several common agents, not only the Claude app; "a little more trouble
   is fine" (08:04). The phone must be supported too (08:04). The eight
   packs are eight scenarios, each split into functionally independent,
   reusable packages (08:04).
4. Pack order as in the business side's ranked list of 2026-11-11: CI failure triage first (08:08).
5. The analysis tool is built in and gives the user a complete report of
   tool calls and token usage; it stays a standard standalone MCP tool that
   does not require countinghouse (08:08; condition of 11-10 16:54).
6. First users: developers, and the people in small teams who do
   operations, sales operations and finance (08:10). Install steps may
   assume someone who can create an API key.
7. Apache-2.0 for the local runtime, the packs and the analysis tool; the
   hosted version and enterprise work are what is charged for (08:15).
   Publication timing unchanged: nothing public before Matt says so, each
   time; the packs repository is created private.
8. The conversation of 2026-11-11 (this design's brainstorm):
   - the receipt lives in the tool result and the agent is asked to show
     it; the callable report is the reliable place;
   - the receipt says what was read and what was returned, never "saved";
   - returned lines pass a redaction step;
   - the PAT for the loop gets Actions read;
   - logs are fetched only for the failed runs among the last fifty,
     fingerprints are cached locally, coverage is stated plainly, including
     "logs expired" and "no failed run";
   - the baseline agent in the closed loop is asked the same cross-run
     question;
   - the report has two layers: the runtime's exact counts for every
     client, and transcript-based totals where a client leaves them; a
     client that leaves nothing gets "not available for this client", no
     estimate; the first release does not wait for layer 2;
   - the receipt is bytes and lines only; tokens are approximate and name
     their method;
   - no fork: countinghouse stays a general host, the packs are a separate
     family built on it;
   - the Node floor: check it first; drop it if that does not weaken the
     sandbox; the launcher may fetch its own Node only as a fallback, only
     with consent, never silently, never touching the system Node, and the
     README says so. Conditions on the shim: adversarial tests and a
     reviewer bypass attempt; CI on 22.16, latest 22, 24.0, 24.14 and
     24.15+; multi-tenant hosting keeps recommending 24.15+; raise the
     floor back when Node 22 reaches end of life (2027-04-30).

## Goals

- A stranger with Node and a GitHub PAT installs pack 1 in Claude Code or
  Cursor and gets the moment above within five minutes. That is the
  acceptance test for the first release. Until Matt lifts the
  publication rule, the test runs from local tarballs: `npm pack` of every
  package and of a countinghouse 7.x build, installed by `ch-local install
  --from <dir>`; a private registry (Verdaccio) is the fallback if the
  tarball path proves unlike the npm path. The plan says which (business
  review, 2026-11-11).
- Each scenario installs alone, needs only its own credentials, and is
  absent when unconfigured.
- Only scenario tools appear in tools/list.
- Nothing leaves the machine except the calls the packs make to the
  user's own servers.
- The receipt and the layer-1 report are exact counts from the runtime.
- The same runtime, unchanged in its public interface for existing
  modules, goes on hosting third-party modules for operators.

## Non-goals

- The hosted version (the hosted-service analysis), beyond keeping its path open.
- Writes to the user's systems in the first release of any pack: packs
  read, or produce a report or a draft. Writes come later, behind a flag.
- Packs for reading-kind workflows (summarise, triage by content), except
  pack 8, which exists to measure that kind.
- Google authorisation and verification, until the workflow list needs it.
- A general plugin marketplace or directory of our own.

## Anti-goals (what makes it a failure even if it works)

1. The first five minutes fail: an old Node that just stops, an agent that
   never calls the tool, or a wait of minutes.
2. Anything leaves the machine: telemetry, anything sent back, a token in
   a log, receipt or cache, raw logs in the cache.
3. The tool list grows: access and step modules visible to the model,
   adding the definition tokens we claim to remove.
4. One scenario demands every credential.
5. A framework for eight before one works.

## Constraints

- countinghouse's own rules hold: it is not a marketplace, it never fetches
  code over the network, modules are distributed over npm, npm is the
  marketplace. Installation is the client's or npm's job.
- countinghouse's security rules hold: a module knows nothing of the user's
  identity; no key, user name or secret in any log line, error text or
  anything a module receives; the always-denied set under audit and
  enforce.
- MCP 2026-07-28, stateless streamable HTTP for the remote transport; stdio
  for local clients; no legacy HTTP+SSE.
- The business plan's content never goes into a public repository. This
  document is the tech side's own and may move to the packs repository.
- Platform independent: Linux, macOS and Windows from the same code, with
  no Mac available for development (Matt, 2026-11-11); see section 2.

## 1. Shape: one runtime, one pack family

No fork (Matt). countinghouse stays the runtime and gains what the packs
need as ordinary features, each a reviewed PR on its own branch:

| Runtime feature | Why the packs need it | Owner | Status |
|---|---|---|---|
| RC1-min: a remote MCP server declared per module, main-thread client, static bearer credential from an environment variable, `ctx.call('remote:<server>/<tool>')`, tools/list recorded at load | access modules call the user's servers; the module never sees the token | A | approved, after L1 |
| RC1 several servers per module | packs 2–7 cross servers | A | after RC1-min |
| RC1 HTTP remotes: a declared REST base URL with a credential header injected by the main thread, `ctx.fetch('remote:<name>', …)` | HubSpot, Slack and Datadog with static tokens, out of the box | A | after multi-server |
| RC1 refresh-token grant: the runtime holds an OAuth client's refresh token and renews access tokens; no browser flow inside the runtime | Gmail (pack 8) | A | after the OAuth front |
| OAuth 2.1 front: resource server per the MCP authorization spec, plus a minimal built-in authorization server where the one local user approves a client once | the phone route; also the hosted version | A | after the grant piece |
| LM1 local store: `--store local` replaces Redis entirely on a client machine (maintainer, 2026-11-11): a file-backed metering provider, the module-facing kv store, and an in-process job runner, behind one selection point; `--store redis` stays the default for hosting | one command, no Redis, nothing to install | B | spec written 2026-11-11 |
| LM1 stdio launcher: starts the runtime in-process and bridges stdio to the gateway (the gateway is stateless per request) | Claude Desktop bundles, and every local client's simplest form | B | with LM1 |
| LM1 scenario loading: load a scenario package and, from node_modules, the modules it declares in `countinghouse.calls`; generate the local auth binding (`runsModules`) for them in memory, with the single-identity profile (no auth file, no balance gate, stable caller id; maintainer, 2026-11-11) | one install per scenario | B | with LM1 |
| LM1 boundary counters: bytes and lines in at each access module's server call, bytes and lines out of each tool result, per call, kept in memory per session and exposed to the report tool | the receipt and the layer-1 report | B | with LM1 |
| Node floor: 22.16 with the resolve shim (section 10) | most developers never hit the floor | B, before LM1 | conditional (section 10) |
| UL1 usage ledger (hash-chained, exportable) | "what the packs' calls replaced", durable across sessions | B | after LM1 |

**One repository per package (Matt, 2026-11-11 ~17:40, reaffirmed after
the tech side recommended one repository).** Each package lives in its own
GitHub repository under `mchen6`, named as the package directory
(`ch-local`, `ch-access-github`, `ch-step-redact`, `ch-step-log-clean`,
`ch-step-error-patterns`, `ch-step-failure-signature`, `ch-step-dedupe`,
`ch-step-owner-hint`, `ch-step-report`, `ch-pack-ci-failure-triage`,
`ch-report`; `ch-trace-report` keeps `countinghouse-trace-report`), each with
its own three-OS CI, a trusted-publishing `publish.yml`, `test/support.js`
in place of the shared harness, and `scripts/validate.js` for modules (the
packed tarball is validated, since a standalone repository's node_modules
holds the runtime's dependencies). Created 2026-11-11 from `ch-packs`
12c29eb; private until Matt makes them public. `ch-packs` stays as the
family repository: this design, the plan, the acceptance tests (Task 13,
from the sibling repositories' tarballs), and nothing that is published.
The npm names are reserved now and each package is published as soon as it
is ready (Matt, same decision; the "nothing before January 2027" rule no
longer applies to the packs).

The pack family's design repository is `ch-packs`. Packages live under an npm scope
Matt owns, `@countinghouse` (Matt, 2026-11-11 10:38 for an owned scope; the name on 2026-11-11 ~17:00),
and keep the `ch-` prefix inside it (tech's call) so names stay
recognisable; creating the organisation and publishing are Matt's, on his
timing. Names: `ch-local` (the launcher), `ch-access-<server>`,
`ch-step-<name>`, `ch-pack-<scenario>`, `ch-report` (the report tool),
`ch-trace-report` (the analysis tool, from its own repository). It contains:
Unscoped names cannot be protected as a family: anyone can publish a
`ch-pack-<x>` that looks like ours, and the install pulls packages by name
and runs them with the user's keys. An npm scope is owned; whether to use
one (`@ch/` or similar) instead of the bare prefix is Matt's call (section
14). Either way `ch-local install` accepts only names from its own
allowlist, pinned by version and integrity hash, never an arbitrary name.

- `launcher/`: the command a developer runs or a client starts
  (`ch-local`): the stdio entry point, the install
  snippets per client, the Node check and the consented fallback, the
  scenario loader's configuration.
- `access/<server>/`, `steps/<name>/`, `packs/<scenario>/`: the modules
  (section 4).
- `analysis/`: the trace-report tool, moved here from its private
  repository as a standalone MCP tool with no countinghouse dependency,
  plus the report tool that reads the runtime's counters (section 6).
- `clients/`: the Claude Code plugin (marketplace manifest, skill, MCP
  config), the `.mcpb` builder, and the Cursor, VS Code and Codex snippets.
- `docs/`: this design, the per-client install pages, the pack READMEs'
  shared wording.

Every module in the family is an ordinary countinghouse module (api.json,
schema.json, handlers, package.json with `countinghouse.calls`), passes
`countinghouse-validate`, runs under `--moduleSandbox enforce`, and is
reviewed like any PR.

## 2. The launcher and local mode

**One command.** `npx ch-local --pack ci-failure-triage` (working
names) starts the runtime in local mode with that scenario loaded, or
prints the per-client configuration snippet with `ch-local snippet <client>`.
Clients that spawn stdio servers run the installed launcher with Node: `command` is the absolute path of the Node that printed the snippet and `args` are `["<home>/bin/ch-local.js", "start", "--pack", "ci-failure-triage", "--stdio"]` (reviewer, 2026-11-11, Windows cannot execute an extensionless file); an nvm or system Node upgrade changes that path, and `ch-local snippet <client>` reprints the entry.

**Local mode** is a runtime configuration, not a build: `--workerThread`,
`--moduleSandbox enforce`, `--store local` (the file-backed store that replaces
Redis), `--stdio`, and `--loadModule` for the scenario with its parts
resolved from node_modules. **One user (maintainer, 2026-11-11):** a client
machine has one user who uses every hosted tool, so the runtime's
single-identity profile applies (LM1 spec, section 4): the key and the
scenario's `runsModules` bindings live in the process's memory, no
`auth.json` is written, the launcher is the only client and passes no key,
and the local metering provider counts for the receipt but never refuses a
call for balance or rate (`--meter` is never passed by the launcher). The
multi-tenant code path is unchanged underneath, so a pack module behaves
identically on a hosted runtime. In HTTP mode (a runtime the user keeps
running, the phone route) a key is needed because a remote client must
present one: the launcher starts that runtime with an `auth.json` it
generates under its own directory (exclusive create on first start, never
changed after), and `--show-key` prints the key once, on request; nothing
else ever does (my call).

**Where files go.** `~/.countinghouse/` (or `$COUNTINGHOUSE_HOME`): the
identity secret and the store, the HTTP-mode `auth.json` when that mode
has been started, module data (one directory per module, as the runtime does
today), the fingerprint cache, the session counters, and a fetched Node if
the user consented. Nothing is written to the working tree.

**Node.** The launcher checks `process.version` first. Below the floor it
stops before loading anything and offers two paths in plain text: install
Node 24 yourself (with the command for the user's platform), or let the
launcher fetch its own copy. The fetch happens only on an explicit yes; the
prompt states what will be downloaded (Node version and platform build),
from where (nodejs.org's release URL), how large, that the SHA-256 is
verified against the published SHASUMS256 file, and where it goes
(`~/.countinghouse/node/`). It never touches the system Node, never runs
silently, and the README documents it, because our users read the code and
their networks often block such downloads. Claude Desktop runs bundles on
its own Node (Electron 44 ships Node 24.18+), so the bundle declares
`compatibility.runtimes.node` and skips the check.

**Nothing leaves the machine.** The launcher and the packs make no network
call except the access modules' calls to the user's declared servers. No
telemetry, no version check, no update check. The fetch above is the one
exception, and it is consented.

**Install at exact versions (amended after the business review, 2026-11-11).**
An unpinned `npx ch-local` would resolve `latest` against the
npm registry on start: a network call the design forbids, and a silent
upgrade. So `npx ch-local install` runs once, installs the
launcher and the chosen packs at exact versions into
`~/.countinghouse/app/` (an npm project with the pack's lockfile, pinned at
release, `npm ci`), and the client entries point at the installed command
(`~/.countinghouse/bin/ch-local.js`, run with Node (reviewer, 2026-11-11, Windows cannot execute an extensionless file)), never at `npx`. Starting a
client makes no network call.

**Upgrade: easy, never silent.** `ch-local upgrade` shows the
installed and available versions and the changelog, asks once, then
installs at exact versions. It is the only command that contacts the npm
registry, and only when the user runs it. A setting, off by default, lets a
user opt in to automatic upgrades (checked at `upgrade`'s next run or by
the client's own updater, below), stated in the README as running new code
with their keys. Releases carry npm provenance (signed by CI). Staleness is
detected without any network call: the tools/list recorded at load for
each declared server is compared on the next load, and a change is
reported in the launcher's output and the report ("GitHub's server changed
3 tools since this pack was tested; run upgrade"). Clients' own updaters:
Claude Code updates plugins from their marketplace (`claude plugin update`);
Claude Desktop updates directory-listed extensions itself; Cursor, VS Code
and Codex have none for a stdio command, so `upgrade` is the path there.
The decision between "easy" and "automatic by default" is Matt's (section
14); this design implements "easy, opt-in automatic".

**Uninstall.** `ch-local uninstall` removes the client entries
it added (it records which files it wrote and what it wrote there), lists
what is in `~/.countinghouse/` (data, caches, usage records, a fetched
Node) and asks before deleting, with `--keep-data`, and ends by reminding
the user which credentials it was given (by variable name) so they can
revoke them. Each client's install page has a removal line. Leaving nothing
behind is part of the claim.

**Several launchers at once.** A developer with three Claude Code
terminals and Cursor open has four launcher processes. They coexist
without a daemon: stdio launchers write no auth file at all, and the
HTTP mode's `auth.json` is read-only after first start (first-start
creation uses an exclusive create); the fingerprint cache is written by
temp-file-and-rename with a merge on read, so two writers lose nothing;
usage records are one append-only file per process (section 6), never
shared for writing; the HTTP mode's port is chosen by the user and only
one HTTP instance runs per port, which the launcher checks and says.
Module data directories are the runtime's, one per module, already safe
for one process; a second process on the same module data is the
runtime's existing single-writer rule, documented, not enforced, in the
first release.

**Operating systems: platform independent by construction (Matt,
2026-11-11: no Mac development machine is available).** The pack family
is pure JavaScript: no native module of its own, no shell script (every
`bin` is a `.js` file), no symlink, paths only through `path` and
`os.homedir()`, atomic writes by temp-file-and-rename (atomic on all three
systems), environment variables read case-insensitively on Windows,
process stop by `child.kill()` with no signal names assumed, stdio in
binary mode, line endings never assumed. The runtime's only native
dependency, `sqlite3`, is optional and serves three things the pack never
uses (the sqlite auth provider, the module registry database, which
`--loadModule` skips, and the user-management CLI), so the launcher
installs with `npm ci --omit=optional` (maintainer, 2026-11-11): no
native binary is downloaded or compiled on any platform, and the
installed tree is pure JavaScript end to end. Testing without a Mac: the pack family's CI runs
its suite on GitHub's `ubuntu-latest`, `macos-latest` and `windows-latest`
runners, and launches the stdio server the same way a client would on each.
Development and the closed loop run on Linux. Claude Desktop itself cannot
run in CI; its bundle is built on Linux (a zip) and its stdio server is
exercised on the macOS and Windows runners, but the Desktop install is
marked untested in the README until a Mac or Windows machine is available.

**Agent-driven install.** In Claude Code the user can say one sentence: the
plugin's skill instructs the agent to run the install command and to add
the server (`claude mcp add` or the plugin's `.mcp.json`). Elsewhere the
user pastes the snippet, which is acceptable (Matt: a little more trouble
is fine).

## 3. Clients

| Client | Transport | Where the config goes | Secrets | Tested by |
|---|---|---|---|---|
| Claude Code | stdio (plugin's `.mcp.json`) or HTTP (`claude mcp add --transport http`) | plugin via `claude plugin marketplace add <repo>` and `claude plugin install`; present in Claude Code 2.1.322 | env in the server entry | us, this machine |
| Cursor | stdio or streamable HTTP | `.cursor/mcp.json` or `~/.cursor/mcp.json`, key `mcpServers`; `${env:NAME}` interpolation | `env` / `envFile` on stdio entries; headers on remote | us |
| VS Code (Copilot) | stdio or HTTP | portable format `~/.copilot/mcp-config.json` (key `mcpServers`, `type` `stdio`/`http`); `.vscode/mcp.json` is deprecated for February 2027 and is not our primary target | `env`; no secret store in the portable format | us |
| Codex CLI | stdio or streamable HTTP (no SSE) | `~/.codex/config.toml` `[mcp_servers.<name>]` or `codex mcp add <name> -- <command>`; HTTP: `url` and `bearer_token_env_var` | env variables named in config | us |
| Claude Desktop | stdio via `.mcpb` | double-click the bundle; `manifest.json` (manifest_version 0.3, server.type node, dependencies bundled); user config fields for credentials | the bundle's user_config, stored by Desktop | bundle built on Linux, its server run on GitHub's macOS and Windows runners; the Desktop install itself untested until a Mac or Windows machine exists |
| ChatGPT | remote HTTPS only | custom connector; OAuth or no auth, no custom headers | OAuth front (section 7) | after the phone route |

Three details, settled 2026-11-11 from the public sources (C, read-only):
Codex `codex mcp add --url` works without OAuth flags, but probes the URL
for OAuth discovery and starts a browser login if the server advertises
it, so once the OAuth front lands the Codex page prefers the TOML entry
(`url` + `bearer_token_env_var`) or stdio; VS Code's portable reader
(`nativeMcpDiscoveryAdapters.ts`) ignores `type` entirely: an entry with
`url` is HTTP, anything else stdio, so writing `type` is harmless; Cursor is
closed source and its docs show remote entries without `type`, so the Cursor
snippet omits it.

The stdio launcher is the primary form for every local client, run as `<node> <home>/bin/ch-local.js start --pack … --stdio` (reviewer, 2026-11-11, Windows cannot execute an extensionless file); HTTP is for
a runtime the user keeps running (and for the phone).

## 4. Layering: access, step, scenario

Three kinds of module, all ordinary countinghouse modules composed with
what exists today: `countinghouse.calls` in package.json, `ctx.call`
in-process over direct peer channels, metered per hop.

**Access modules**, one per server. Each declares exactly one remote MCP
server (RC1's declaration: name, transport, URL, the environment variable
its credential comes from) and exposes a small typed surface over that
server's tools: stable action names, paging folded in, fields trimmed to
what steps need. They are the only modules with network and the only ones
whose declaration names a credential; the main thread holds both. They
have no tools of their own in the model's sense: they are called in-process
and never appear in tools/list (anti-goal 3; the gateway lists a module's
tools only when the module is loaded as a scenario, which is LM1's loader
rule).

**Step modules**, shared transforms: pure JSON in, JSON out, no
permissions, no network, no file access beyond their own data directory.
Testable with fixtures alone, which is why they can be built before RC1.

**Scenario modules**, one per pack: thin; declare `calls` to the access
and step modules they use; one tool, two at most; the README states the
kind (carrying or reading), the servers, the credential variables, the
declared output (the tool's outputSchema in words), and the coverage
rules. Only these are loaded as scenarios and only their tools are listed.

**The eight scenarios cut into parts** (working names; the step list is a
starting point, not a contract; a step is split or merged when the second
user of it shows the boundary):

| # | Scenario module | Access modules | Step modules |
|---|---|---|---|
| 1 | `pack-ci-failure-triage` | `access-github` | `step-log-clean`, `step-error-patterns`, `step-failure-signature`, `step-dedupe`, `step-owner-hint`, `step-report` |
| 2 | `pack-errors-into-tickets` | `access-sentry`, `access-linear` | `step-failure-signature` (stack form), `step-cluster-by-signature`, `step-report` |
| 3 | `pack-standup-digest` | `access-github`, `access-slack`, `access-linear` | `step-join-by-key`, `step-window` (last 24 h), `step-report` |
| 4 | `pack-alert-evidence` | `access-datadog` (or `access-grafana`, `access-pagerduty`), `access-github` | `step-window`, `step-align-by-key` (request id, service, time), `step-log-clean`, `step-report` |
| 5 | `pack-call-into-crm` | `access-hubspot`, local file reader (a step, not an access module) | `step-entity-match` (contact, deal), `step-report` (draft of the log entry; the write is behind a flag) |
| 6 | `pack-csv-against-crm` | `access-hubspot` | `step-csv`, `step-entity-match`, `step-report` |
| 7 | `pack-payout-reconciliation` | `access-stripe`, `access-slack` (post is behind a flag), ledger from a local file | `step-join-by-key`, `step-threshold-match`, `step-report` |
| 8 | `pack-inbox-fetch-trim` | `access-gmail` (our OAuth client) | `step-html-strip`, `step-field-trim` |

Shared by every scenario: `step-redact` (secrets and tokens in text; start
from the rules in countinghouse's `examples/log-triage` redact step and
keep them in one place, applied to everything a scenario returns) and
the receipt (section 6), which the runtime attaches, not the module.

**Versioning and install.** Each module is an npm package with semver. A
scenario lists its access and step modules under `dependencies` with caret
ranges; its lockfile records what it was tested with; a release of a
scenario is tested against the versions it pins. A user installs one
scenario package; npm pulls its parts; the credentials to set are the
union of its access modules' variables, and the launcher prints them. Two
scenarios installed together share an access module at one version per
node_modules resolution, which is npm's ordinary rule; the runtime loads
each module once per path.

**Composition and identity.** A scenario's `calls` entries name
`<module>/<service>.<action>`, enforced on the main thread (R2-1). The
local auth binding (`runsModules`) is generated by the runtime in memory
for the loaded scenario and its parts, so there is no auth.json for the
user to edit.

**Parts are loaded, not listed (my call).** A module declares its role in
package.json: `countinghouse.role` is `"scenario"` or `"part"` (access and
step modules). The loader loads parts with `listed: false`; the gateway
leaves an unlisted module's tools out of tools/list and refuses a direct
tools/call or invoke-action to them from outside the process; in-process
hops from a scenario reach them as today. A module with no role is
listed, as every module is now, so nothing changes for existing modules.

**Owner hint (my call).** `step-owner-hint` returns GitHub logins only,
never emails or display names, and the scenario's README says that
colleagues' logins are part of the output; `--no-owner-hint` turns it off.

**Missing server or credential.** Refused at load, not at call time: the
scenario does not load, the error names the server and the variable, the
scenario's tools are absent from tools/list, and the launcher's output
says so once. Other scenarios load normally.

## 5. Pack 1: CI failure triage

**Tool**: `ci_failure_triage` (one tool). Arguments: none required. Optional
`run_id` (a specific run), `repo` (`owner/name` when the working tree has
no GitHub remote or has several), `window` (default 50 runs). The
repository comes from the `origin` remote of the working directory the
client reports (MCP roots when the client sends them; otherwise the
launcher's working directory; otherwise `repo` is required and the error
says so).

**Chain** (fixed, in the scenario module, each hop an in-process call):

1. `access-github`: list the last `window` workflow runs for the
   repository's default branch and the current branch; take the latest
   failed run (or `run_id`); list its jobs; for the failed jobs, fetch the
   logs. Then, for every other failed run in the window whose logs have
   not been fingerprinted yet, fetch the failed jobs' logs. Logs are
   fetched only for failed runs; successful runs cost one list call.
2. `step-log-clean`: strip timestamps, ANSI, group markers, progress
   lines; keep step boundaries.
3. `step-error-patterns`: the error lines (the benchmark's extraction:
   known runner and tool patterns, assertion and stack heads, the last
   lines before a non-zero exit).
4. `step-failure-signature`: a stable fingerprint per failed job
   (normalised error lines, step name, numbers and paths generalised).
5. `step-dedupe`: group the window's failures by signature; count; first
   and last seen with commit SHAs; branch; flaky (same commit passed
   elsewhere or the signature alternates with passes) or new (first seen
   in the latest run).
6. `step-owner-hint`: the authors of the commits where the signature first
   appeared and of the failing step's recent changes, from the run's
   commit metadata (no blame call in version 1); a suggestion, never an
   action.
7. `step-redact`, then `step-report`: the result object.

**Output** (declared in schema.json; the README says it in words):
`run` (id, url, branch, commit, workflow, job, step), `errors` (the few
lines, redacted, at most N), `history` (signature id, count in window,
window size, first seen commit and date, last seen, verdict flaky/new/
recurring, the earlier runs' ids), `owner_hint` (names and why, or null),
`coverage` (runs listed, failed runs found, logs fetched, logs expired or
unavailable, cache hits), and the receipt (section 6). When there is no
failed run in the window, the tool says so and returns the last success;
when logs have expired, the history says which runs were skipped and why.

**Cache**: `~/.countinghouse/data/pack-ci-failure-triage/<repo>/fingerprints.json`:
run id, job id, signature, error-line hashes, step name, commit, dates.
Never a raw log line, never a token. A rerun fetches only new failed runs.

**Credential**: a fine-grained PAT with Metadata, Contents and Actions
read on the repositories in question, in `GITHUB_TOKEN` or a name the
launcher prints. The loop's PAT (decided 2026-11-11 00:05) gains Actions read.

**Agent adoption**: the tool description leads with "Call this first when a
CI run failed"; the Claude Code plugin's skill says the same and shows the
receipt line verbatim in the answer; the "both exposed" benchmark arm
measures whether the agent reaches for it unprompted, and the first
installable release ships with that number.

**Seconds**: the first call on a repository with many failed runs fetches
many logs; the result says how many; subsequent calls use the cache. A
hard cap (default 20 logs per call) keeps the first call bounded, and the
coverage block says when the cap was hit.

## 6. Measurement: receipt, report, layers

**Counters** (LM1, runtime): at each access module's server call, bytes
and lines received (lines of text content; bytes of the MCP result); at
each scenario tool's result, bytes and lines returned after redaction.
Written as they happen to an append-only local file, one per launcher
process, `~/.countinghouse/usage/<date>/<pid>-<start>.jsonl` (amended
after the business review: in memory only, the audit would not survive a
stdio session, and "what happened this week" could not be answered). One
record per call: time, MCP session id when the client sends one, pack,
tool, server, bytes and lines in and out, duration, outcome, and the name
(never the value) of the credential used. Exact counts; nothing estimated.
The report tool reads these files, so it needs no running runtime and no
port; UL1 later adds the hash chain and the export format on the same
records. `ch-local report` prints the report on the command
line and exports JSON or CSV, so reading the audit costs no tokens and can
be handed to someone else.

**The receipt**: one line appended by the runtime to every scenario tool's
result (a `receipt` field in the structured result and the same sentence
in the text content): "read 48,000 log lines across 12 runs; 35 lines
reached the model." Bytes and lines only. The word "saved" does not
appear. The description and the skill ask the agent to show it.

**The report tool** (`analysis/`, a standard MCP tool, also usable with no
countinghouse at all):

- Layer 1, every client: from the runtime's counters (read over the
  runtime's local HTTP endpoint or the shared counters file): calls, bytes
  and lines read and returned, per session, tool, server and pack; "one
  pack call stood for N server calls" as a count.
- Layer 2, where the client leaves transcripts or exports: the session's
  total tokens and the calls that did not go through countinghouse (the
  leaf calls the agent made directly, which are where the next packs come
  from, and the share of the session the tools took). Per client, checked
  2026-11-11, to verify against a real file before building:
  - Claude Code: transcripts under `~/.claude/projects/` (trace-report
    reads them today); an OpenTelemetry export with `tool_result` and
    `api_request` events carrying tokens and cost (`CLAUDE_CODE_ENABLE_TELEMETRY`).
  - Codex CLI: session rollouts as JSONL under `~/.codex/sessions/`, with
    token-count events (schema differs by version); an OTLP export exists.
  - VS Code Copilot: chat sessions as JSON or JSONL under the workspace
    storage's `chatSessions`; format changed at 1.109; no documented
    tool-call telemetry found.
  - Cursor: chats in a SQLite store (`state.vscdb`), undocumented schema
    that changes between versions; community exporters only.
  - Claude Desktop: nothing local.
  - A client with nothing: "not available for this client". No estimate.
- Layer 1 shows no token figure at all (my call): bytes and lines are
  exact, tokens would be a guess. Tokens appear only in layer 2, taken
  from the transcript's or export's own counts, and the report names that
  source beside every token figure. Where a transcript gives content but
  no counts, the report says so rather than tokenizing it. Savings, when
  stated, are estimates with their method, in the terms of 11-10: fewer
  tokens and more headroom, never "a lower bill". The estimate fix in
  trace-report (price removed tokens as billed) remains the gate before
  any saving figure is shown.

The first release ships layer 1 and the receipt; layer 2 follows with
Claude Code first.

## 7. The phone

Route (a) first: the user's own always-on machine runs the launcher in
HTTP mode behind a tunnel (cloudflared or Tailscale Funnel; one documented
page), and the phone adds it as a custom connector. Route (b), the hosted
version with one instance per user, later and on the same foundation.

Both need an endpoint mobile and web clients can sign in to. Checked
2026-11-11: ChatGPT's custom connectors take OAuth or no auth and no custom
header; Claude's help centre documents a "request headers" field for a
static bearer on custom connectors, mobile install is in beta, and whether
the field appears on the phone is undocumented. So countinghouse gains an
OAuth 2.1 front (section 1): the resource server part per the MCP
authorization spec, and a minimal built-in authorization server where the
one local user approves a client once, from the machine. Until it exists,
Claude's phone app may already work with the `X-CH-Key` request header;
Matt tests that once (needs-matt).

## 8. Credentials and the vendors' servers

Checked 2026-11-11 against each vendor's docs or README:

| Server | Static credential on the hosted MCP server |
|---|---|
| GitHub | PAT as bearer |
| Sentry | API token in a `Sentry-Bearer` authorization header (OAuth default) |
| Linear | API key as bearer (OAuth default; read-only endpoint exists) |
| Stripe | restricted key as bearer; from December 2026 only keys with the Agent tag |
| Datadog | API key + application key headers; model changing (June 2026 post), re-check at pack 4 |
| HubSpot | OAuth 2.1 with PKCE only |
| Slack | OAuth only, confidential client, no dynamic registration |

So RC1-min covers packs 1, 2 and 4 through the vendors' MCP servers.

**HubSpot and Slack: the vendor's REST API with a static token (amended
after the business review).** Their MCP servers are OAuth-only, and a
refresh-token grant still makes the user register an app and obtain a
token somewhere, far from out of the box. Both vendors' own APIs take a
static token (a HubSpot private-app access token; a Slack bot token), and
so does Datadog's. So RC1 gains a second kind of remote beside an MCP
server: an HTTP remote, declared with a base URL and the credential's
variable, which the main thread calls on the module's behalf, injecting
the credential header; the module calls `ctx.fetch('remote:<name>', path,
options)` and never sees the token. The injected credential goes only to
the declared base URL's host: a module passes a path, never an absolute
URL; a redirect to another host is not followed with the header (and is
reported as a violation); the response's headers are not handed to the
module (business review, 2026-11-11). An access module then chooses, per
server, the vendor's MCP server or its REST API, whichever takes a static
credential and has the stable surface the steps need. The refresh-token
grant stays for Gmail (pack 8). Trade-off stated in each access module's
README: a REST surface is ours to maintain; an MCP surface is the vendor's.

Order (Matt, 10:38): 1, 2, 4 (MCP remotes), then 3, 5, 6, 7 (HTTP
remotes), then 8.
Credentials are environment variables named by the access module; the
launcher prints which are missing and which name it used; the main thread
holds them; no module sees one. For GitHub the launcher reads
`COUNTINGHOUSE_GITHUB_TOKEN` first and falls back to `GITHUB_TOKEN`, says
which it used (name only), and at load probes once for the Actions read
scope, failing with a clear line when it is missing.

**Test accounts for packs 2 and 4 (needs Matt, later):** a Sentry
organisation (free tier) with one project that a tiny app feeds errors
into; a Linear workspace (free); Datadog (trial) or Grafana Cloud (free)
with one data source; a PagerDuty developer account. We generate the data;
Matt creates the accounts under his own identity when pack 2 starts.

## 9. The closed loop and fairness

Pack 1 is the loop's composite. Baseline: the same fixed set of failed runs
on the two public repositories (10 on countinghouse, 2 on the registry at
2026-11-11), the same cross-run question asked of the baseline agent with
GitHub's own MCP server, ten runs each arm, read-only. Compared: tokens and
cost medians (from transcripts), the triage result's correctness against a
hand-made answer key, and how often the agent chose the pack in the "both
exposed" arm. Reported whatever it shows, checkable by an outsider: method,
the composite's source, the numbers; transcripts only as far as they hold
nothing private.

## 10. The Node floor

**Finding (2026-11-11, half a day, time-boxed).** The 24.15 floor exists
because `module.registerHooks` resolve hooks do not see `require.resolve`
or `createRequire().resolve` before 24.15 (22.x included). Replicated on
22.23.4 and 24.14.1: `require()` goes through the hook, both resolves skip
it. Everything else the runtime uses exists on 22.23 (`registerHooks`,
`getBuiltinModule`, `--permission`, worker heap statistics,
`loadEnvFile`; no newer syntax). The gap is a security matter, not only a
feature: a module's `require.resolve` on an older Node bypasses the
lockdown's require boundary and the broker's virtual-path mapping, so a
module could probe host paths without a recorded violation.

The sandbox test folder on Node 22.23.4 with the floor lowered and no shim:
323 passing, 2 pending, 5 failing. Four are the gap directly (the
lockdown's `reachesLib` check, the hardened probe's `require.resolve`, the
floor test itself, the validator's `require.resolve`); the fifth, the
sandboxed validator's reads of `/app/package.json` and `/app/api.json`
returning ENOENT, is in the broker's virtual-path handling, which is built
on the same hooks, and is probably the same cause but is not proven.

**Decision (conditional, Matt).** Floor 22.16 (the first 22 with
`registerHooks`) with a resolve shim, on condition that the shim makes all
five pass. The shim: on Node below 24.15 only, wrap the CommonJS resolver
(`Module._resolveFilename`) so that a resolve from module code runs the
same two hooks the runtime already owns (the broker's identity hook, then
the lockdown's), with a re-entrancy guard so a resolve already inside the
hook chain is not run twice; about fifty lines on a version-gated path.
Adversarial tests: reaching the unwrapped resolver through
`createRequire`, `module.constructor`, `process.getBuiltinModule('module')`,
a captured `require` from before lockdown, and `require.resolve.paths`; a
reviewer bypass attempt before merge. CI runs the sandbox tests on 22.16,
latest 22, 24.0, 24.14 and 24.15+. README: "a compatibility shim is used
below 24.15; multi-tenant hosting of third-party modules should run
24.15+ with the native hook". A dated note raises the floor to 24 when
Node 22 reaches end of life (2027-04-30). If the validator case survives
the shim, the floor question returns to Matt.

## 11. Security and privacy rules for the family

- No telemetry, no phone-home, no update check. The only outbound calls
  are access modules' calls to declared servers.
- No key, token or secret in any log line, error text, receipt, report,
  cache or anything a module receives. Caches hold fingerprints and
  hashes. `step-redact` runs on everything a scenario returns.
- Only scenario tools in tools/list. Access and step modules are
  in-process callees.
- Each scenario loads alone; an unconfigured one is absent, with one
  launcher line saying why.
- Every module runs under `--moduleSandbox enforce` in local mode; the
  always-denied set applies; the launcher's own directory is outside every
  module's namespace.
- Writes to the user's systems are behind a per-scenario flag, off by
  default, in a later release.

## 12. Left to the builder

- The exact step boundaries (section 4's table is a start).
- The receipt sentence's wording and the result's field names, within
  the rules above.
- The fingerprint algorithm and the error-pattern rules (reuse the
  benchmark chain's).
- The launcher's user-facing text, within section 2's rules.
- The per-client snippet details and the three unverified client facts.
- Which of cloudflared and Tailscale Funnel the phone page documents
  first.

## 13. Sequencing

- A: L1 (merging) → RC1-min → several servers per module → HTTP remotes
  with credential injection → OAuth front → refresh-token grant (Gmail).
- B: error series (c13 in CI) → Node floor shim and tests → LM1 (metering,
  stdio launcher, scenario loading, counters) → UL1.
- C (the packs): this design's plan → `step-redact`, `step-log-clean`,
  `step-error-patterns`, `step-failure-signature`, `step-dedupe`,
  `step-owner-hint`, `step-report` with fixture tests (no RC1 needed) →
  `access-github` the day RC1-min merges → `pack-ci-failure-triage` →
  the launcher and the Claude Code plugin with B → the closed loop.
- First installable: a Claude Code plugin and a Cursor snippet with pack 1
  and the receipt, around 11-25; the `.mcpb` a few days after Matt's
  probe result; packs 2 and 4 by early December; the phone route after
  the OAuth front.

## 14. Needs Matt

1. Approve this design.
2. Create the private repository for the pack family (or authorise its
   creation), and reserve the npm scope and names from his own account.
3. (Deferred: no Mac available.) The Node probe bundle waits for a Mac or
   Windows machine; Electron 44's Node 24.18+ makes it a confirmation, not
   a blocker.
4. On the phone: add a custom connector to a tunnelled endpoint with an
   `X-CH-Key` request header, and say whether the field exists.
5. ~~Pack order swap~~: decided 10:38, 1, 2, 4, 3, 5, 6, 7, 8.
6. ~~Upgrade policy~~: decided 10:38, "easy, opt-in automatic" as section 2
   implements it.
8. ~~npm scope~~: decided 10:38, an owned scope; named `@countinghouse` on
   2026-11-11 ~17:00. Releases publish by npm trusted publishing from
   each package repository's `.github/workflows/publish.yml` (no token, no 2FA code; that repository's README);
   Matt creates the organisation, does each package's one manual first
   publish and configures its trusted publisher, on his timing. The `countinghouse` package on npm (6.1.0) is his
   account (maintainer `out4b <seeds.c@gmail.com>`, checked 2026-11-11),
   so that name is safe; a 7.x release with RC1 and LM1 must be published
   before `ch-local install` can work from npm, on his timing.
7. ~~Token figures~~: decided 10:37, an approximate token column in the
   report only (command line, export, callable tool), labelled as an
   estimate naming its method (UTF-8 bytes / 4 in v1), beside the exact
   bytes and lines; the receipt stays bytes and lines.
