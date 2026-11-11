# Publishing to npm

Every package of the family is published under the `@countinghouse` scope
by `.github/workflows/publish.yml`, using npm **trusted publishing**: the
workflow proves its identity to npm with a short-lived GitHub OIDC token.
No npm token exists in this repository or in GitHub secrets, no 2FA code is
typed for a release, and npm attaches provenance to every version it
publishes this way (the upgrade design relies on that provenance).

Nothing is published before Matt says so (standing rule: not before
January 2027). The workflow only runs on a `v*` tag pushed to a commit on
`main`, or by hand.

## Once per package, by the maintainer

npm lets a trusted publisher be configured only on a package that already
exists, so each new package needs one manual first publish, with the
maintainer's 2FA code, from this repository:

```
npm publish --workspace modules/ch-step-redact --access public
```

A placeholder version is enough; it is public from that moment.

Then, on npmjs.com, for that package: **Settings → Trusted publishing →
GitHub Actions**, with

| Field | Value |
|---|---|
| Organization or user | `mchen6` |
| Repository | `ch-packs` |
| Workflow filename | `publish.yml` |
| Environment name | leave empty |
| Allowed actions | `npm stage publish` **and** `npm publish` |

Allowing `npm publish` is what makes a release automatic: configurations
created after September 2026 default to staged publishing, which asks the
maintainer to approve each release with 2FA, which is the step this setup
removes. Then **Settings → Publishing access → "Require two-factor
authentication and disallow tokens"**: it blocks token publishes and does
not affect trusted publishing.

A new trusted publisher configuration expires unless its first successful
publish happens within two days, so configure it when a release is ready
to run, not earlier. If it expires, delete it and create it again.

## Once for the organisation

The `countinghouse` organisation on npm is Matt's, created from his own
account. Free for public packages.

## Every release

1. Bump the versions of the workspaces that changed (each package has its
   own version).
2. Merge to `main`, wait for CI.
3. Tag that commit `v<date or number>` and push the tag. The workflow runs
   the suite and validation, then publishes every workspace whose version
   is not on npm yet, and skips the rest.

A package npm has never seen is reported as MISSING and fails the run at
the end, after the others are published: do its manual first publish and
re-run the workflow by hand.

## What the package.json files must hold

`scripts/test/workspaces.test.js` checks each workspace for the name
`@countinghouse/<directory>`, `publishConfig.access: public` (scoped
packages are private by default), and a `repository` whose `url` is exactly
`https://github.com/mchen6/ch-packs.git` with `directory` set: trusted
publishing refuses a package whose repository field does not match the
repository the token came from.

## Requirements

npm 11.5.1 or later and Node 22.14 or later on the runner (the workflow
uses Node 24 and checks the npm version first). GitHub-hosted runners only.
Provenance is generated only when the repository is public, which it will
be at the first publication.
