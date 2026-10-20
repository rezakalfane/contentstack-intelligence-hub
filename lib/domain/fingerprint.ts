import { createHash } from "node:crypto";

/** Normalise whitespace so cosmetic edits do not change the fingerprint. */
export function normalizeText(text: string): string {
  return text.normalize("NFC").replace(/\s+/g, " ").trim();
}

export function fingerprint(text: string): string {
  return createHash("sha256").update(normalizeText(text)).digest("hex").slice(0, 16);
}

export function shortId(prefix: string, input: string): string {
  return `${prefix}_${createHash("sha1").update(input).digest("hex").slice(0, 12)}`;
}
