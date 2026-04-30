/**
 * Operator-aware tokenizer for the /search page.
 *
 * Supported operators:
 *   from:user | from:assistant
 *   model:<id-substring>
 *   before:<YYYY-MM-DD | Nd | Nmo>
 *   after:<YYYY-MM-DD | Nd | Nmo>
 *   in:space:<name|id>
 *   in:conv:<id>
 *   "exact phrase"
 *
 * Anything that doesn't parse as an operator becomes a bare term (AND).
 * Quoted segments become phrases (also AND).
 *
 * The tokenizer is intentionally forgiving: malformed operators silently
 * downgrade to bare terms so the search still does *something*. The API
 * layer is responsible for the actual semantics.
 */

export type ParsedQuery = {
  terms: string[];
  phrases: string[];
  from?: "user" | "assistant";
  model?: string;
  before?: Date;
  after?: Date;
  spaceFilter?: { kind: "id" | "name"; value: string };
  convId?: string;
};

const OPERATORS = new Set(["from", "model", "before", "after", "in"]);

/**
 * Parse a relative date like `7d`, `1mo`, `3w`, `1y` into a Date in the past
 * (or absolute ISO `YYYY-MM-DD`). Returns null if it can't be parsed.
 */
function parseDateValue(raw: string): Date | null {
  const v = raw.trim();
  if (!v) return null;

  // ISO YYYY-MM-DD or any Date.parse-able absolute string.
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d;
    return null;
  }

  // Relative: <n><unit>
  const m = /^(\d+)\s*(d|w|mo|m|y|h)$/i.exec(v);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (!Number.isFinite(n)) return null;

  const now = Date.now();
  let ms = 0;
  switch (unit) {
    case "h": ms = n * 60 * 60 * 1000; break;
    case "d": ms = n * 24 * 60 * 60 * 1000; break;
    case "w": ms = n * 7 * 24 * 60 * 60 * 1000; break;
    case "m":
    case "mo": ms = n * 30 * 24 * 60 * 60 * 1000; break;
    case "y": ms = n * 365 * 24 * 60 * 60 * 1000; break;
    default: return null;
  }
  return new Date(now - ms);
}

/**
 * Tokenize the query string, respecting double-quoted phrases.
 * Returns an array of { value, quoted } tokens preserving order.
 */
function tokenize(input: string): Array<{ value: string; quoted: boolean }> {
  const out: Array<{ value: string; quoted: boolean }> = [];
  let i = 0;
  const n = input.length;
  while (i < n) {
    const ch = input[i];
    if (ch === " " || ch === "\t" || ch === "\n") { i++; continue; }
    if (ch === '"') {
      // consume until closing quote (or end)
      let j = i + 1;
      let buf = "";
      while (j < n && input[j] !== '"') {
        buf += input[j];
        j++;
      }
      // skip closing quote if present
      if (j < n && input[j] === '"') j++;
      if (buf.length > 0) out.push({ value: buf, quoted: true });
      i = j;
      continue;
    }
    // bare run until whitespace or quote
    let j = i;
    let buf = "";
    while (j < n) {
      const cj = input[j];
      if (cj === " " || cj === "\t" || cj === "\n" || cj === '"') break;
      buf += cj;
      j++;
    }
    if (buf.length > 0) out.push({ value: buf, quoted: false });
    i = j;
  }
  return out;
}

export function parseQuery(input: string): ParsedQuery {
  const result: ParsedQuery = { terms: [], phrases: [] };
  const tokens = tokenize(input ?? "");

  for (const tok of tokens) {
    if (tok.quoted) {
      result.phrases.push(tok.value);
      continue;
    }

    // Try to read as operator. Format: key:value (or in:space:value / in:conv:value).
    const colonIdx = tok.value.indexOf(":");
    if (colonIdx <= 0) {
      result.terms.push(tok.value);
      continue;
    }

    const key = tok.value.slice(0, colonIdx).toLowerCase();
    const rest = tok.value.slice(colonIdx + 1);

    if (!OPERATORS.has(key) || rest.length === 0) {
      // unknown operator → treat the whole token as a term
      result.terms.push(tok.value);
      continue;
    }

    if (key === "from") {
      const v = rest.toLowerCase();
      if (v === "user" || v === "assistant") {
        result.from = v;
      } else {
        result.terms.push(tok.value);
      }
      continue;
    }

    if (key === "model") {
      result.model = rest;
      continue;
    }

    if (key === "before") {
      const d = parseDateValue(rest);
      if (d) result.before = d;
      else result.terms.push(tok.value);
      continue;
    }

    if (key === "after") {
      const d = parseDateValue(rest);
      if (d) result.after = d;
      else result.terms.push(tok.value);
      continue;
    }

    if (key === "in") {
      // in:space:<name|id> or in:conv:<id>
      const innerColon = rest.indexOf(":");
      if (innerColon <= 0) {
        result.terms.push(tok.value);
        continue;
      }
      const sub = rest.slice(0, innerColon).toLowerCase();
      const val = rest.slice(innerColon + 1);
      if (!val) {
        result.terms.push(tok.value);
        continue;
      }
      if (sub === "conv") {
        result.convId = val;
      } else if (sub === "space") {
        // cuid-ish heuristic: starts with c + 24+ alnum chars
        const looksLikeId = /^c[a-z0-9]{20,}$/i.test(val);
        result.spaceFilter = looksLikeId
          ? { kind: "id", value: val }
          : { kind: "name", value: val };
      } else {
        result.terms.push(tok.value);
      }
      continue;
    }
  }

  return result;
}
