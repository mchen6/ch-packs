'use strict';
// The few lines that matter from one failed job, out of ch-step-log-clean's
// steps. A pure function of its input.
//
// Kinds, in priority order:
//   exit    "Process completed with exit code N", N > 0: the line that marks
//           the failing step;
//   error   a ##[error] line, an error or exception name (TypeError,
//           IllegalStateException), "error" or "ERROR" as a word (npm, tsc,
//           gcc, pip, Maven), FAIL/FAILED, panic:, fatal:, TAP's "not ok"
//           (not with # SKIP or # TODO), node --test's ✖;
//   assert  one of those that says Assertion or Expected, or "expected …"
//           with to, but, got, received or actual (not tsc's "';' expected");
//   stack   a stack frame (JavaScript "  at …", Python '  File "…"'), never an
//           error itself whatever it names: the first two within ten lines
//           after an error or assertion, and for a Python traceback its head
//           and its two innermost frames (Python prints the raising frame
//           last);
//   tail    when fewer than five lines matched: the last fifteen lines of the
//           failing step (or of the last step that ran a command).
// failingStep is the step holding the last exit line, else the last step with
// an error line, else null.

const EXIT = /Process completed with exit code [1-9]\d*/;
const ERROR = /^##\[error\]|\b(?:[A-Z][A-Za-z]*)?(?:Error|Exception)\b|\berror\b|\bERROR\b|\bFAIL(?:ED)?\b|\b(?:panic|fatal):|^\s*not ok\b|^\s*✖/;
const TAP_DIRECTIVE = /^\s*not ok\b.*#\s*(?:SKIP|TODO)\b/i;
const ASSERT = /Assertion|\bExpected\b|\bexpected\b(?=.*\b(?:to|but|got|received|actual)\b)/;
const TRACEBACK = /^\s*Traceback \(most recent call last\):/;
const FRAME = /^\s+at\s|^\s+File "/;
const FRAME_WINDOW = 10;
const FRAMES_PER_ERROR = 2;
const TAIL_BELOW = 5;
const TAIL_LINES = 15;
const TRACEBACK_MAX = 200;
// Over maxLines: the exit line first, then errors, assertions and frames
// together in log order (a frame explains the error beside it), the tail last.
const RANK = {exit: 0, error: 1, assert: 1, stack: 1, tail: 2};

function classify(text) {
  if (EXIT.test(text)) return 'exit';
  if (FRAME.test(text) || TAP_DIRECTIVE.test(text)) return null;
  if (ERROR.test(text)) return ASSERT.test(text) ? 'assert' : 'error';
  if (TRACEBACK.test(text)) return 'stack';
  return null;
}

// -> {failingStep, lines: [{step, index, text, kind}], truncated}, the lines
// in log order. Over maxLines, the failing step's lines are kept first, by kind
// (exit, then errors and assertions, then frames, then the tail), earlier
// before later.
function extractErrors(steps, maxLines) {
  const found = []; // {s, index, text, kind}
  steps.forEach((step, s) => {
    const kinds = step.lines.map(classify);
    step.lines.forEach((text, index) => {
      if (kinds[index] === 'error' || kinds[index] === 'assert') {
        let frames = 0;
        for (let j = index + 1; j < step.lines.length && j <= index + FRAME_WINDOW && frames < FRAMES_PER_ERROR; j++) {
          if (FRAME.test(step.lines[j])) {
            frames++;
            if (kinds[j] === null) kinds[j] = 'frame';
          }
        }
      } else if (kinds[index] === 'stack' && TRACEBACK.test(text)) {
        // The traceback's indented body, up to its exception line.
        const frames = [];
        for (let j = index + 1; j < step.lines.length && j <= index + TRACEBACK_MAX && /^\s/.test(step.lines[j]); j++) {
          if (FRAME.test(step.lines[j])) frames.push(j);
        }
        for (const j of frames.slice(-FRAMES_PER_ERROR)) if (kinds[j] === null) kinds[j] = 'frame';
      }
    });
    kinds.forEach((kind, index) => {
      if (kind !== null) found.push({s, index, text: step.lines[index], kind: kind === 'frame' ? 'stack' : kind});
    });
  });

  // The last exit line: an earlier one is a continue-on-error step's.
  const exitAt = found.findLast((l) => l.kind === 'exit');
  const lastError = found.findLast((l) => l.kind === 'error' || l.kind === 'assert');
  const failing = exitAt ? exitAt.s : lastError ? lastError.s : null;

  if (found.length < TAIL_BELOW) {
    let t = failing;
    if (t === null) {
      for (let s = steps.length - 1; s >= 0 && t === null; s--) if (/^Run /.test(steps[s].name)) t = s;
    }
    if (t !== null) {
      const taken = new Set(found.filter((l) => l.s === t).map((l) => l.index));
      const lines = steps[t].lines;
      for (let index = Math.max(0, lines.length - TAIL_LINES); index < lines.length; index++) {
        if (!taken.has(index)) found.push({s: t, index, text: lines[index], kind: 'tail'});
      }
    }
  }

  const byLog = (a, b) => (a.s - b.s) || (a.index - b.index);
  const byKeep = (a, b) => ((b.s === failing) - (a.s === failing)) || (RANK[a.kind] - RANK[b.kind]) || byLog(a, b);
  const kept = [...found].sort(byKeep).slice(0, maxLines).sort(byLog);
  return {
    failingStep: failing === null ? null : steps[failing].name,
    lines: kept.map((l) => ({step: steps[l.s].name, index: l.index, text: l.text, kind: l.kind})),
    truncated: found.length > maxLines
  };
}

module.exports = {extractErrors};
