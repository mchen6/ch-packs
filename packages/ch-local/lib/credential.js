'use strict';
// The credential a launcher uses: the first of `names` whose value is real.
// Client entries name every variable, so an unset one can arrive as '' (Claude
// Code's ${VAR:-}) or, from a client that leaves it unresolved, as its own
// placeholder: both count as missing, so the fallback is reached.
const isPlaceholder = (v) => /^\$\{[^}]*\}$/.test(v.trim());

function pickCredential(env, names) {
  for (const name of names) {
    const value = env[name];
    if (typeof value === 'string' && value.trim() !== '' && !isPlaceholder(value)) return {name, value};
  }
  return null;
}

module.exports = {pickCredential};
