'use strict';
// The triage result, assembled: one summary sentence and the parts in a fixed
// field order, so every answer reads the same way. The receipt is not here:
// the runtime attaches it, from what it counted.

const RUN = ['id', 'url', 'branch', 'commit', 'workflow', 'job', 'step'];
const HISTORY = ['signature', 'count', 'window', 'verdict', 'firstSeen', 'lastSeen', 'runIds'];
const SEEN = ['runId', 'commit', 'createdAt'];
const COVERAGE = ['runsListed', 'failedRuns', 'logsFetched', 'logsExpired', 'cacheHits', 'capHit'];

const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));
const short = (sha) => sha.slice(0, 7);

// One sentence: the step, the verdict, how often in the window, since when.
function summaryOf(run, history) {
  const who = run.step == null ? 'The job' : `Step '${run.step}'`;
  if (history == null) return `${who} failed; its log could not be read, so it has no failure history.`;
  const {verdict, count, window, firstSeen} = history;
  if (verdict === 'new') return `${who} failed with a new signature, seen only in this run of the last ${window}.`;
  if (count === 1) return `${who} failed with a ${verdict} signature seen once in the last ${window} runs, at ${short(firstSeen.commit)}.`;
  return `${who} failed with a ${verdict} signature seen ${count} times in the last ${window} runs, first at ${short(firstSeen.commit)}.`;
}

// {run, errors, history, ownerHint, coverage} ->
// {summary, run, errors, history, owner_hint, coverage}, in that order.
function assembleReport({run, errors, history, ownerHint, coverage}) {
  return {
    summary: summaryOf(run, history),
    run: pick(run, RUN),
    errors: [...errors],
    history: history == null ? null : {...pick(history, HISTORY), firstSeen: pick(history.firstSeen, SEEN), lastSeen: pick(history.lastSeen, SEEN)},
    owner_hint: ownerHint == null ? null : {logins: [...ownerHint.logins], why: [...ownerHint.why]},
    coverage: pick(coverage, COVERAGE)
  };
}

module.exports = {assembleReport, summaryOf, FIELDS: {RUN, HISTORY, SEEN, COVERAGE}};
