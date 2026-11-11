# Installing a pack in your client

One page per client:

- [Claude Code](claude-code.md)
- [Cursor](cursor.md)
- [VS Code (Copilot)](vscode.md)
- [Codex CLI](codex.md)
- [Claude Desktop](claude-desktop.md)

Every client runs the same launcher: the Node you have, with
`~/.countinghouse/bin/ch-local.js start --pack ci-failure-triage --stdio`
(`$COUNTINGHOUSE_HOME` instead of `~/.countinghouse` when it is set). The
launcher is installed once, with `npx @countinghouse/ch-local install --pack
ci-failure-triage`; that command arrives with the launcher's first release.

`ch-local snippet <client>` prints the exact entry for this machine. The
entry names the absolute path of the Node that ran `ch-local`, because a
client started from the dock or the Start menu often has no `PATH` set up by
nvm. An nvm or system Node upgrade changes that path: run `ch-local snippet
<client>` again and replace the entry.

The pack reads GitHub with a read-only token in `COUNTINGHOUSE_GITHUB_TOKEN`
(or, failing that, `GITHUB_TOKEN`). No entry ever contains the token itself,
only the variable's name.
