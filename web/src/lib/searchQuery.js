// The search box understands `age:` / `edad:` filters (with =, >, <, >=, <=)
// and `&` to require several parts at once, e.g. "ana & edad:>30". The server
// evaluates the query; this module only describes it for the chips shown
// under the box, so both must read the syntax the same way.

const AGE_TERM = /^(?:age|edad):(>=|<=|>|<)?(\d+)$/i;
const OP_SYMBOL = { '>=': '≥', '<=': '≤', '>': '>', '<': '<', '': '' };

/** The `&`-separated parts of a query, trimmed and without empty ones. */
export function splitSearchParts(query) {
  return String(query ?? '').split('&').map((p) => p.trim()).filter(Boolean);
}

/** `{ op, value }` when the part is an age filter, otherwise null. */
export function parseAgePart(part) {
  const m = AGE_TERM.exec(String(part ?? '').trim());
  return m ? { op: m[1] ?? '', value: parseInt(m[2], 10) } : null;
}

/** Text of each part for display: age filters read as "Age ≥ 30", words stay as typed. */
export function searchChips(query, ageLabel) {
  return splitSearchParts(query).map((part) => {
    const age = parseAgePart(part);
    if (!age) return part;
    const symbol = OP_SYMBOL[age.op];
    return `${ageLabel} ${symbol}${symbol ? ' ' : ''}${age.value}`;
  });
}

/** Chips only help when the query is more than plain words: an age filter or several parts. */
export function showSearchChips(query) {
  const parts = splitSearchParts(query);
  return parts.length > 1 || (parts.length === 1 && parseAgePart(parts[0]) !== null);
}
