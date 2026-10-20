// Tokens that must survive translation unchanged.
const TOKEN_PATTERNS: RegExp[] = [
  /\{\{[^{}]+\}\}/g, // {{firstName}}
  /\{[A-Za-z_][\w.]*\}/g, // {sku}
  /%(?:\d+\$)?[sd]/g, // %s %1$s %d
  /\]\(([^)\s]+)\)/g, // markdown link targets
  /<\/?[A-Za-z][^<>]*>/g, // html tags
  /https?:\/\/[^\s)]+/g, // bare urls
];

export function extractTokens(text: string): string[] {
  const found: string[] = [];
  for (const re of TOKEN_PATTERNS) {
    for (const m of text.matchAll(new RegExp(re.source, re.flags))) found.push(m[0]);
  }
  return found.sort();
}

export interface TokenDiff {
  missing: string[];
  unexpected: string[];
}

/** Multiset comparison: tokens present in the source but not preserved, and vice versa. */
export function diffTokens(source: string, target: string): TokenDiff {
  const count = (xs: string[]) => {
    const m = new Map<string, number>();
    for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
    return m;
  };
  const a = count(extractTokens(source));
  const b = count(extractTokens(target));
  const missing: string[] = [];
  const unexpected: string[] = [];
  for (const [k, n] of a) if ((b.get(k) ?? 0) < n) missing.push(k);
  for (const [k, n] of b) if ((a.get(k) ?? 0) < n) unexpected.push(k);
  return { missing, unexpected };
}
