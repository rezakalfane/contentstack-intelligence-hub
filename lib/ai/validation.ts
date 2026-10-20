import { z } from "zod";
import { diffTokens } from "@/lib/domain/placeholders";

export const TranslationOutputSchema = z.object({
  translatedText: z.string(),
  glossaryWarnings: z.array(z.string()),
  placeholderWarnings: z.array(z.string()),
  notes: z.array(z.string()),
  confidenceLabel: z.enum(["high", "medium", "low"]).nullable(),
});
export type TranslationOutput = z.infer<typeof TranslationOutputSchema>;

export interface GlossaryEntry {
  term: string;
  /** "keep" = do-not-translate. Otherwise required rendering per locale prefix (e.g. fr, de). */
  rule: "keep" | { [localePrefix: string]: string };
}

export const GLOSSARY_VERSION = "2026-10-20";
export const GLOSSARY: GlossaryEntry[] = [
  { term: "Contentstack", rule: "keep" },
  { term: "BigCommerce", rule: "keep" },
  { term: "Commerce B2B", rule: "keep" },
];

export interface ValidationResult {
  /** Errors block approval (tokens altered, empty). */
  blocking: string[];
  /** Warnings need reviewer attention but do not block. */
  warnings: string[];
  placeholderWarnings: string[];
  glossaryWarnings: string[];
}

export function validateTranslation(
  source: string,
  target: string,
  opts: { maxLength?: number; glossary?: GlossaryEntry[] } = {},
): ValidationResult {
  const placeholderWarnings: string[] = [];
  const glossaryWarnings: string[] = [];
  const warnings: string[] = [];
  const blocking: string[] = [];

  if (!target.trim()) blocking.push("Translation is empty");

  const diff = diffTokens(source, target);
  for (const m of diff.missing) placeholderWarnings.push(`Missing token ${m}`);
  for (const u of diff.unexpected) placeholderWarnings.push(`Unexpected token ${u}`);
  if (placeholderWarnings.length) blocking.push("Placeholders/markup differ from the source");

  for (const g of opts.glossary ?? GLOSSARY) {
    if (g.rule === "keep" && source.includes(g.term) && !target.includes(g.term)) {
      glossaryWarnings.push(`"${g.term}" is a do-not-translate term but is absent from the translation`);
    }
  }

  if (opts.maxLength && target.length > opts.maxLength) warnings.push(`Longer than the ${opts.maxLength}-character limit`);
  if (source.trim().length >= 12 && target.trim().length > source.trim().length * 3) {
    warnings.push("Translation is more than 3× longer than the source (possible hallucination)");
  }
  const nl = (s: string) => s.split("\n").length;
  if (nl(source) !== nl(target)) warnings.push(`Line/block count changed (${nl(source)} → ${nl(target)})`);

  return { blocking, warnings: [...warnings, ...glossaryWarnings], placeholderWarnings, glossaryWarnings };
}
