# ch-packs

countinghouse client packs: a local launcher (`ch-local`), reusable access,
step and scenario modules (`ch-access-*`, `ch-step-*`, `ch-pack-*`), the
usage report tool (`ch-report`), and the per-client installers.

Status: design approved (2026-11-11). This is the family repository: the
design (`docs/superpowers/specs/2026-11-11-client-packs-design.md`), the plan,
and the acceptance tests. Each package has its own repository under
`mchen6`, named as the package (`ch-local`, `ch-access-github`, `ch-step-*`,
`ch-pack-ci-failure-triage`, `ch-report`), published to npm as
`@countinghouse/<name>` by trusted publishing from that repository. The
`modules/` and `packages/` directories here are the pre-split sources and
are removed once the acceptance scripts read the sibling repositories.

Built on [countinghouse](https://github.com/mchen6/countinghouse). Apache-2.0.
