import { GLOSSARY, GLOSSARY_VERSION } from "./validation";

export const PROMPT_VERSION = "tr-v1";

export interface TranslationRequest {
  sourceLocale: string;
  targetLocale: string;
  contentType: string;
  fieldLabel: string;
  sourceText: string;
  existingText?: string;
  maxLength?: number;
}

export const OUTPUT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["translatedText", "glossaryWarnings", "placeholderWarnings", "notes", "confidenceLabel"],
  properties: {
    translatedText: { type: "string" },
    glossaryWarnings: { type: "array", items: { type: "string" } },
    placeholderWarnings: { type: "array", items: { type: "string" } },
    notes: { type: "array", items: { type: "string" } },
    confidenceLabel: { type: ["string", "null"], enum: ["high", "medium", "low", null] },
  },
} as const;

export function buildMessages(req: TranslationRequest) {
  const keep = GLOSSARY.filter((g) => g.rule === "keep").map((g) => g.term);
  const system = [
    "You are a professional localization specialist for e-commerce and marketing content.",
    `Translate the text from ${req.sourceLocale} into ${req.targetLocale}, following regional conventions of the target locale (number, currency and date formats, punctuation, formal/informal register consistent with brand copy).`,
    "Rules:",
    "- Preserve every placeholder, token and markup EXACTLY (e.g. {{firstName}}, {sku}, %s, HTML tags, Markdown links and URLs).",
    `- Never translate these brand/legal terms: ${keep.join(", ") || "(none)"}.`,
    "- Keep the same number of lines; do not add, drop or explain content.",
    "- Do not output anything other than the JSON object requested.",
    "- List in the warning arrays anything a human reviewer should double-check; use confidenceLabel only as a coarse qualitative label (never a percentage).",
  ].join("\n");
  const user = JSON.stringify({
    task: "translate",
    contentType: req.contentType,
    field: req.fieldLabel,
    maxLength: req.maxLength ?? null,
    existingTranslation: req.existingText ?? null,
    glossaryVersion: GLOSSARY_VERSION,
    sourceText: req.sourceText,
  });
  return { system, user };
}
