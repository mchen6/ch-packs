# Cursor

## Add

`ch-local snippet cursor` prints the entry for this machine. Merge it into
`~/.cursor/mcp.json` (every project) or `.cursor/mcp.json` (one project),
under `mcpServers`:

    {
      "mcpServers": {
        "ci-failure-triage": {
          "command": "/usr/local/bin/node",
          "args": ["/home/you/.countinghouse/bin/ch-local.js", "start", "--pack", "ci-failure-triage", "--stdio"],
          "env": {
            "COUNTINGHOUSE_GITHUB_TOKEN": "${env:COUNTINGHOUSE_GITHUB_TOKEN}",
            "GITHUB_TOKEN": "${env:GITHUB_TOKEN}"
          }
        }
      }
    }

Cursor resolves `${env:NAME}` in `command`, `args`, `env`, `url` and
`headers` ([docs](https://cursor.com/docs/context/mcp)), so the file holds
the variable's name, never the token.

## Token

The variable must be set in the environment Cursor itself was started from.
Cursor started from the dock, the Start menu or a desktop icon does not see
what your shell's profile sets; start it from a terminal (`cursor .`), or set
the variable for your desktop session.

## Node

The entry names the absolute path of your Node. An nvm or system Node upgrade
changes that path: run `ch-local snippet cursor` again and replace the entry.

## Remove

Delete the `ci-failure-triage` entry from the `mcpServers` of the file you
added it to.
