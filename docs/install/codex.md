# Codex CLI

## Add

`ch-local snippet codex` prints the entry for this machine. Append it to
`~/.codex/config.toml`:

    [mcp_servers.ci-failure-triage]
    command = "/usr/local/bin/node"
    args = ["/home/you/.countinghouse/bin/ch-local.js", "start", "--pack", "ci-failure-triage", "--stdio"]
    env_vars = ["COUNTINGHOUSE_GITHUB_TOKEN", "GITHUB_TOKEN"]

`env_vars` lists the variables Codex passes from its own environment to the
server ([docs](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)); the
file holds their names, never the token. The config-file entry is preferred
over `codex mcp add --url`, which probes the server for OAuth and may start a
browser login.

## Token

Set `COUNTINGHOUSE_GITHUB_TOKEN` in the shell you start `codex` from.

## Node

The entry names the absolute path of your Node. An nvm or system Node upgrade
changes that path: run `ch-local snippet codex` again and replace the entry.

## Remove

    codex mcp remove ci-failure-triage

or delete the `[mcp_servers.ci-failure-triage]` table from
`~/.codex/config.toml`.
