'use strict';
// Input checks shared by the githubService handlers.

// 'owner/name' -> {owner, repo}, or null.
function parseRepo(value) {
  if (typeof value !== 'string') return null;
  const m = /^([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]{1,100})$/.exec(value);
  if (m == null || m[2] === '.' || m[2] === '..') return null;
  return {owner: m[1], repo: m[2]};
}

const isId = (v) => typeof v === 'string' && /^[1-9]\d{0,15}$/.test(v) && Number.isSafeInteger(Number(v));
const isSha = (v) => typeof v === 'string' && /^[0-9a-f]{40}$/.test(v);

const invalid = (message) => new DeviceError('ARGUMENTS_INVALID', message);

module.exports = {parseRepo, isId, isSha, invalid};
