'use strict';
// docs/install: one page per client, each with the way in and the way out.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const {CLIENTS} = require('../lib/snippets');

const DOCS = path.join(__dirname, '..', '..', '..', 'docs', 'install');

test('every client has an install page with its snippet command and a removal section', () => {
  for (const client of CLIENTS) {
    const page = fs.readFileSync(path.join(DOCS, `${client}.md`), 'utf8');
    assert.ok(page.includes(`ch-local snippet ${client}`), client);
    assert.match(page, /^## Remove/m, client);
  }
});

test('pages that pin a node say an upgrade changes it and how to reprint', () => {
  for (const client of CLIENTS.filter((c) => c !== 'claude-desktop')) {
    const page = fs.readFileSync(path.join(DOCS, `${client}.md`), 'utf8');
    assert.match(page, /upgrade\s+changes\s+(this|that|the)\s+path/i, client); // across a line wrap
  }
});
