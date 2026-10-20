import { z } from "zod";

export const SEO_PROMPT_VERSION = "seo-v1";

export const SeoOutputSchema = z.object({
  text: z.string(),
  notes: z.array(z.string()),
});
export type SeoOutput = z.infer<typeof SeoOutputSchema>;

export const SEO_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["text", "notes"],
  properties: { text: { type: "string" }, notes: { type: "array", items: { type: "string" } } },
} as const;

export interface SeoRequest {
  target: "meta_title" | "meta_description";
  locale: string;
  contentType: string;
  entryTitle: string;
  currentText: string;
  problem: string;
  excerpt: string;
  min: number;
  max: number;
}

export function buildSeoMessages(req: SeoRequest) {
  const kind = req.target === "meta_title" ? "meta title (the <title> shown in search results)" : "meta description (the snippet shown in search results)";
  const system = [
    "You are a senior SEO copy editor.",
    `Write a ${kind} in the language and locale ${req.locale}.`,
    "Rules:",
    `- Length: between ${req.min} and ${req.max} characters. Count carefully.`,
    "- Use ONLY facts present in the provided title, current text and excerpt. Never invent products, prices, claims, statistics or guarantees.",
    "- Preserve brand and product names exactly. Keep any placeholders ({{x}}, %s) and markup unchanged.",
    "- Lead with the most useful information. No clickbait, no quotation marks, no ALL CAPS, no emoji.",
    "- If rewriting, keep the meaning of the current text and fix only the stated problem.",
    "- Put anything the editor should double-check in `notes`. Output only the JSON object requested.",
  ].join("\n");
  const user = JSON.stringify({
    task: req.currentText.trim() ? "rewrite" : "generate",
    contentType: req.contentType,
    entryTitle: req.entryTitle,
    problemToFix: req.problem,
    currentText: req.currentText || null,
    pageExcerpt: req.excerpt,
  });
  return { system, user };
}
