'use strict';
// Publishes every workspace whose name@version is not on npm yet. Run by
// .github/workflows/publish.yml under npm trusted publishing (OIDC): no token,
// no 2FA code. A package must already exist on npm with a trusted publisher
// configured for that workflow; the first version of a new package is
// published by hand, once (docs/publishing.md). Such a package is reported
// and the run fails at the end, after the others are published, so a tag
// never looks fully published when it is not.
//
//   node scripts/publish-changed.js [--dry-run]   list, then publish (or not)
//   node scripts/publish-changed.js --check-npm   exit 1 if npm < 11.5.1
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const MIN_NPM = [11, 5, 1]; // trusted publishing needs npm 11.5.1 or later

// Every workspace directory with a package.json, from the root's globs
// (`<top>/*` only, which is what this repository uses).
function workspaces(root) {
  const globs = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).workspaces || [];
  const found = [];
  for (const glob of globs) {
    const top = glob.replace(/\/\*$/, '');
    for (const entry of fs.readdirSync(path.join(root, top), {withFileTypes: true})) {
      if (!entry.isDirectory()) continue;
      const file = path.join(root, top, entry.name, 'package.json');
      if (!fs.existsSync(file)) continue;
      found.push({dir: `${top}/${entry.name}`, pkg: JSON.parse(fs.readFileSync(file, 'utf8'))});
    }
  }
  return found;
}

// What npm knows about a package: {status: 404} for no such package,
// {status: 0, versions: [...]} otherwise, {status, stderr} on any other error.
function npmView(name) {
  const r = spawnSync('npm', ['view', name, 'versions', '--json'], {encoding: 'utf8'});
  if (r.status !== 0) return /E404/.test(r.stderr || '') ? {status: 404} : {status: r.status, stderr: r.stderr};
  const parsed = r.stdout.trim() === '' ? [] : JSON.parse(r.stdout);
  return {status: 0, versions: Array.isArray(parsed) ? parsed : [parsed]};
}

// 'published': this version exists; 'new': the package exists, this version
// does not; 'absent': no such package on npm (first publish is by hand).
function registryState(name, version, view) {
  const r = view(name);
  if (r.status === 404) return 'absent';
  if (r.status !== 0) throw new Error(`npm view ${name} failed: ${r.stderr}`);
  return r.versions.includes(version) ? 'published' : 'new';
}

// The plan: every public workspace with its registry state.
function plan(list, view) {
  return list
    .filter((w) => w.pkg.private !== true)
    .map((w) => ({dir: w.dir, name: w.pkg.name, version: w.pkg.version, state: registryState(w.pkg.name, w.pkg.version, view)}));
}

function npmIsRecentEnough(versionString) {
  const [a, b, c] = versionString.trim().split('.').map(Number);
  const [x, y, z] = MIN_NPM;
  return a > x || (a === x && (b > y || (b === y && c >= z)));
}

function main(argv) {
  if (argv.includes('--check-npm')) {
    const v = spawnSync('npm', ['--version'], {encoding: 'utf8'}).stdout;
    if (!npmIsRecentEnough(v)) {
      console.error(`npm ${v.trim()} is older than ${MIN_NPM.join('.')}; trusted publishing needs ${MIN_NPM.join('.')} or later`);
      return 1;
    }
    console.log(`npm ${v.trim()}`);
    return 0;
  }
  const dryRun = argv.includes('--dry-run');
  const root = path.join(__dirname, '..');
  let absent = 0;
  for (const entry of plan(workspaces(root), npmView)) {
    const label = `${entry.name}@${entry.version}`;
    if (entry.state === 'published') { console.log(`skip    ${label}: already on npm`); continue; }
    if (entry.state === 'absent') {
      console.log(`MISSING ${label}: the package is not on npm; its first version is published by hand (docs/publishing.md)`);
      absent++;
      continue;
    }
    console.log(`${dryRun ? 'would publish' : 'publish'} ${label} (${entry.dir})`);
    if (dryRun) continue;
    const r = spawnSync('npm', ['publish', '--workspace', entry.dir, '--access', 'public'], {stdio: 'inherit'});
    if (r.status !== 0) { console.error(`publish failed for ${label}`); return r.status || 1; }
  }
  if (absent > 0) { console.error(`${absent} package(s) not on npm yet; nothing else was skipped`); return 1; }
  return 0;
}

module.exports = {workspaces, registryState, plan, npmIsRecentEnough, MIN_NPM};

if (require.main === module) process.exitCode = main(process.argv.slice(2));
