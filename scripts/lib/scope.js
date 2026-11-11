'use strict';
// The npm scope every package of the family is published under: the
// countinghouse organisation on npm, which Matt owns (named 2026-11-11). Every
// package.json name is `${SCOPE}/<directory>`, which scripts/test/workspaces.test.js
// checks, together with the repository and publishConfig fields that npm
// trusted publishing needs (docs/publishing.md).
module.exports = {SCOPE: '@countinghouse'};
