# VS Code (Copilot)

## Add

`ch-local snippet vscode` prints the entry for this machine, in the portable
format of `~/.copilot/mcp-config.json`. Merge it under `mcpServers`:

    {
      "mcpServers": {
        "ci-failure-triage": {
          "type": "stdio",
          "command": "/usr/local/bin/node",
          "args": ["/home/you/.countinghouse/bin/ch-local.js", "start", "--pack", "ci-failure-triage", "--stdio"]
        }
      }
    }

`.vscode/mcp.json` is deprecated for February 2027, so it is not the target
here.

## Token

The portable format has no secret store, so the entry carries no `env`: the
server inherits VS Code's environment. Set `COUNTINGHOUSE_GITHUB_TOKEN` in the
environment VS Code was started from. Started from the dock or the Start
menu, it does not see your shell's profile; start it from a terminal
(`code .`), or set the variable for your desktop session.

## Node

The entry names the absolute path of your Node. An nvm or system Node upgrade
changes that path: run `ch-local snippet vscode` again and replace the entry.

## Remove

Delete the `ci-failure-triage` entry from `~/.copilot/mcp-config.json`.
