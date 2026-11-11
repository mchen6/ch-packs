# Claude Code

## Add

The plugin is the simplest route:

    claude plugin marketplace add mchen6/ch-packs
    claude plugin install ch-packs@ch-packs

It adds the `ci_failure_triage` tool and a skill that tells Claude to call it
first when a CI run failed. The plugin runs the installed launcher; if it is
not installed yet, the tool fails with one line naming the install command.

Or add the server by hand. `ch-local snippet claude-code` prints the command
for this machine, for example:

    claude mcp add --scope user ci-failure-triage --env 'COUNTINGHOUSE_GITHUB_TOKEN=${COUNTINGHOUSE_GITHUB_TOKEN:-}' --env 'GITHUB_TOKEN=${GITHUB_TOKEN:-}' -- /usr/local/bin/node /home/you/.countinghouse/bin/ch-local.js start --pack ci-failure-triage --stdio

The single quotes matter: they keep your shell from putting the token's value
into the config. Claude Code expands `${VAR:-}` itself when it starts the
server ([docs](https://code.claude.com/docs/en/mcp)).

## Token

Set `COUNTINGHOUSE_GITHUB_TOKEN` in the environment you start Claude Code
from. Never paste a token into the conversation or into a config file.

## Node

The hand-added entry names the absolute path of your Node. An nvm or system
Node upgrade changes that path: run `ch-local snippet claude-code` again,
then `claude mcp remove --scope user ci-failure-triage` and add the new line.
The plugin runs `node` from your `PATH` and needs nothing.

## Remove

    claude plugin uninstall ch-packs@ch-packs

or, for the hand-added server:

    claude mcp remove --scope user ci-failure-triage
