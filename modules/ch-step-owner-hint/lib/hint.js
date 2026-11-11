'use strict';
// Who might know about a failure: GitHub logins only, never an e-mail or a
// display name (the access module strips those; this step refuses anything that
// is not a login, so none can pass through it). A suggestion, never an action.

const MAX_LOGINS = 3;
// GitHub's rule: letters, digits and single inner hyphens, at most 39
// characters; an app's bot account adds "[bot]".
const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}(?:\[bot\])?$/;
const COMMIT = /^[0-9a-f]{7,40}$/;

const isLogin = (s) => typeof s === 'string' && LOGIN.test(s);
const isCommitRef = (c) => c != null && typeof c.commit === 'string' && COMMIT.test(c.commit)
  && (c.authorLogin === null || isLogin(c.authorLogin));
const short = (sha) => sha.slice(0, 7);

// -> {logins, why}: the author of the commit where the failure first appeared,
// then the authors of the recent changes in the order given, each once, at
// most three; why[i] says why logins[i] is there.
function ownerHint({firstSeen, stepCommits}) {
  const logins = [];
  const why = [];
  const add = (login, reason) => {
    if (login === null || logins.includes(login) || logins.length >= MAX_LOGINS) return;
    logins.push(login);
    why.push(`${login}: ${reason}`);
  };
  if (firstSeen) add(firstSeen.authorLogin, `author of ${short(firstSeen.commit)}, the commit where this failure first appeared`);
  for (const c of stepCommits) add(c.authorLogin, `author of ${short(c.commit)}, a recent change before this failure`);
  return {logins, why};
}

module.exports = {ownerHint, isLogin, isCommitRef};
