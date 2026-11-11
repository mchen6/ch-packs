'use strict';
// The npm scope every package of the family is published under. Matt owns the
// scope and has not named it yet (2026-11-11 10:38), so it is written @SCOPE
// here and in every package.json; naming it is one search-and-replace of
// "@SCOPE" across the repository (this constant and every package name), which
// scripts/test/workspaces.test.js then checks.
module.exports = {SCOPE: '@SCOPE'};
