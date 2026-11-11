'use strict';
// One GitHub Actions job log, cleaned into steps. A pure function of its input.
//
// A job log's layout (checked against a real one, 2026-11-11): a UTF-8 BOM; an
// ISO timestamp on every line; each step opened by a `##[group]Run <command>`
// header group that holds only the command and its shell/env lines, the
// step's output following the header's `##[endgroup]`; other groups (checkout's
// "Fetching the repository", say) nested inside a step's output; post steps
// opened by a plain "Post job cleanup." line; the set-up lines before the first
// step. So a step runs from its header to the next header, a group that is not
// a header is only markers to drop, and what comes before the first header is
// the step "(top)".

const BOM = /^﻿/;
const TIMESTAMP = /^\d{4}-\d\d-\d\dT[\d:.]+Z(?: |$)/;
const ANSI = /\x1b\[[0-9;?]*[A-Za-z]/g;
const GROUP = /^##\[group\](.*)$/;
const ENDGROUP = /^##\[endgroup\]/;
const STEP_HEADER = /^Run /;
const POST_STEP = /^Post job cleanup\.?$/;
const PROGRESS = [/^\s*[\d.]+%/, /^\s*[|/\\-]\s*$/, /Receiving objects:/, /Resolving deltas:/];
const TOP = '(top)';

// -> {steps: [{name, lines}], totalLines, kept}: totalLines counts the input's
// lines (a final newline ends the last one, it does not start another), kept
// the lines in steps. Dropped: group markers, progress lines, blank lines.
function cleanLog(text) {
  const raw = text.replace(BOM, '').split(/\r?\n/);
  if (raw[raw.length - 1] === '') raw.pop();
  const steps = [];
  let current = {name: TOP, lines: []};
  const open = (name) => {
    if (current.name !== TOP || current.lines.length > 0) steps.push(current);
    current = {name, lines: []};
  };
  let kept = 0;
  for (const rawLine of raw) {
    // A carriage return inside a line is a progress bar redrawing itself:
    // keep what a terminal would show last.
    const shown = rawLine.includes('\r') ? rawLine.slice(rawLine.lastIndexOf('\r') + 1) : rawLine;
    const line = shown.replace(TIMESTAMP, '').replace(ANSI, '').trimEnd();
    const group = GROUP.exec(line);
    if (group) {
      if (STEP_HEADER.test(group[1])) open(group[1].trim());
      continue;
    }
    if (ENDGROUP.test(line)) continue;
    if (POST_STEP.test(line)) {
      open('Post job cleanup');
      continue;
    }
    if (line.trim() === '' || PROGRESS.some((re) => re.test(line))) continue;
    current.lines.push(line);
    kept++;
  }
  if (current.name !== TOP || current.lines.length > 0) steps.push(current);
  return {steps, totalLines: raw.length, kept};
}

module.exports = {cleanLog};
