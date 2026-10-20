import { fingerprint } from "@/lib/domain/fingerprint";
import type { LocaleInfo, NormalizedContentType, NormalizedEntry, SchemaField } from "@/lib/domain/types";
import { CTAS, ENTRY_TITLES, HEADLINES, LOCALE_META, SENTENCES, type DemoLocale, type Phrase } from "./bank";

// Deterministic offline sample world. 5 locales, 4 content types, 56 source entries.
// Every KPI in DEMO mode is computed from these records by the same pipeline as live data.

export const DEMO_STACK = "Global commerce (sample)";
export const DEMO_ENV_UID = "demo-prod";
export const DEMO_MASTER: DemoLocale = "en-us";
const ENTRIES_PER_TYPE = 14;

const field = (uid: string, displayName: string, dataType: SchemaField["dataType"], o: Partial<SchemaField> = {}): SchemaField => ({
  uid, displayName, dataType, mandatory: false, multiple: false, nonLocalizable: false, hasEnum: false, ...o,
});
const text = (uid: string, name: string, mandatory = false, o: Partial<SchemaField> = {}) => field(uid, name, "text", { mandatory, ...o });
const internalTitle = () => text("title", "Internal name", true, { nonLocalizable: true });

export const DEMO_CONTENT_TYPES: NormalizedContentType[] = [
  {
    uid: "campaign", title: "Campaign",
    schema: [
      internalTitle(),
      field("hero", "Hero", "group", { schema: [text("title", "Title", true), text("description", "Description", true)] }),
      text("seo_meta_description", "SEO meta description", true),
      text("cta_label", "CTA label", true),
      text("url", "URL", false, { nonLocalizable: true }),
      text("meta_title", "Meta title"),
      field("hero_image_alt", "Hero image alt text", "text"),
      field("highlights", "Highlights", "group", { multiple: true, schema: [text("text", "Text")] }),
      field("related_page", "Related landing page", "reference", { referenceTo: ["landing_page"], nonLocalizable: true }),
      field("hero_image", "Hero image", "file", { nonLocalizable: true }),
    ],
  },
  {
    uid: "landing_page", title: "Landing page",
    schema: [
      internalTitle(),
      text("url", "URL", false, { nonLocalizable: true }),
      text("meta_title", "Meta title"),
      text("hero_title", "Hero title", true),
      text("hero_description", "Hero description"),
      text("cta_label", "CTA label"),
      text("seo_description", "SEO description", true),
      field("featured_story", "Featured story", "reference", { referenceTo: ["product_story"], nonLocalizable: true }),
      field("hero_image", "Hero image", "file", { nonLocalizable: true }),
      field("sections", "Sections", "blocks", { blocks: [{ uid: "feature", displayName: "Feature", schema: [text("heading", "Heading"), text("copy", "Copy")] }] }),
    ],
  },
  {
    uid: "product_story", title: "Product story",
    schema: [
      internalTitle(),
      text("headline", "Headline", true),
      text("sku", "SKU", false, { nonLocalizable: true }),
      text("summary", "Summary", true),
      text("key_features", "Key features", false, { multiple: true }),
      text("cta_label", "CTA label"),
      field("related_editorial", "Related editorial", "reference", { referenceTo: ["editorial"], multiple: true, nonLocalizable: true }),
      field("gallery", "Gallery", "file", { multiple: true, nonLocalizable: true }),
    ],
  },
  {
    uid: "editorial", title: "Editorial",
    schema: [
      internalTitle(),
      text("url", "URL", false, { nonLocalizable: true }),
      text("meta_title", "Meta title"),
      field("published", "Published", "isodate", { nonLocalizable: true }),
      text("byline", "Byline", false, { nonLocalizable: true }),
      text("headline", "Headline", true),
      text("standfirst", "Standfirst"),
      field("body", "Body", "json"),
      text("seo_description", "SEO description"),
      field("related_campaign", "Related campaign", "reference", { referenceTo: ["campaign"], nonLocalizable: true }),
      field("cover", "Cover image", "file", { nonLocalizable: true }),
      text("cover_alt", "Cover image alt text"),
    ],
  },
];

export const DEMO_LOCALES: LocaleInfo[] = LOCALE_META.map((l) => ({ code: l.code, name: l.name, fallbackLocale: l.fallback }));
export const DEMO_CRITICAL_LOCALES = ["it-it", "fr-fr"];

const hash = (...parts: (number | string)[]) => {
  let h = 2166136261;
  for (const p of parts) for (const ch of String(p)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) % 100;
};
type RteBlock = string | { h: number; text: string } | { link: string; text: string };
const rte = (blocks: RteBlock[], embed?: { uid: string; _content_type_uid: string }) => ({
  type: "doc", uid: "root", attrs: {},
  children: [
    ...blocks.map((b, i) =>
      typeof b === "string"
        ? { type: "p", uid: `p${i}`, attrs: {}, children: [{ text: b }] }
        : "h" in b
          ? { type: `h${b.h}`, uid: `h${i}`, attrs: {}, children: [{ text: b.text }] }
          : { type: "p", uid: `p${i}`, attrs: {}, children: [{ text: `${b.text} ` }, { type: "a", attrs: { url: "/guides/buying" }, children: [{ text: b.link }] }, { text: "." }] },
    ),
    // JSON RTE entry embed: counted as a reference by the graph, ignored by text analysis (no text leaf).
    ...(embed ? [{ type: "reference", uid: "emb", attrs: { type: "entry", "entry-uid": embed.uid, "content-type-uid": embed._content_type_uid, "display-type": "block" }, children: [{ text: "" }] }] : []),
  ],
});
const meta = (uid: string) => ({ uid });
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const uidOf = (ct: string, n: number) => `${ct}_${String(((n % ENTRIES_PER_TYPE) + ENTRIES_PER_TYPE) % ENTRIES_PER_TYPE + 1).padStart(2, "0")}`;
const ref = (ct: string, n: number) => ({ uid: uidOf(ct, n), _content_type_uid: ct });
const asset = (n: number) => ({ uid: `asset_${n % 6}`, filename: `${["autumn", "winter", "studio", "workshop", "materials", "journal"][n % 6]}-${n % 6}.jpg`, url: `https://example.invalid/assets/${n % 6}.jpg`, content_type: "image/jpeg" });

const MISSING_RATE: Record<string, number> = { "it-it": 11, default: 5 };
const UNTRANSLATED_RATE: Record<string, number> = { "it-it": 5, default: 3 };
const NOT_LOCALIZED_RATE: Record<string, number> = { "it-it": 22, "es-es": 7, "de-de": 6, "fr-fr": 4 };

type Translator = (phrase: Phrase, key: string) => string;

function content(ctUid: string, e: number, t: Translator, master = false): Record<string, unknown> {
  const S = (k: number) => SENTENCES[k % SENTENCES.length] as Phrase;
  const H = (k: number) => HEADLINES[k % HEADLINES.length] as Phrase;
  const C = (k: number) => CTAS[k % CTAS.length] as Phrase;
  const title = ENTRY_TITLES[e % ENTRY_TITLES.length] as string;
  // Deliberate SEO problems in the MASTER locale (targets inherit structure, not the gaps).
  // Meta title: unique "<headline> | <entry name>" with deliberate defects (empty, too long, a duplicated pair on campaigns).
  const metaTitle = (k: number) =>
    e === 4 ? (master ? "" : `${t(H(k), "mt")} | ${title}`)
    : e % 5 === 2 ? t(S(e + 9), "mt-long")
    : ctUid === "campaign" && (e === 1 || e === 9) ? t(H(2), "mt-dup")
    : `${t(H(k), "mt")} | ${title}`;
  // Meta description: unique by construction (pair derived from a per-entry number), with deliberate defects:
  // occasionally the bare entry name (too short, and duplicated across types) or three sentences (too long).
  const entryNo = DEMO_CONTENT_TYPES.findIndex((c) => c.uid === ctUid) * ENTRIES_PER_TYPE + e;
  const metaDesc = (_k: number, key: string) => {
    const a = entryNo % 12, c = Math.floor(entryNo / 12), b = (a + 1 + c * 2) % 12;
    return e % 7 === 3 ? `${title}.`
      : e % 9 === 4 ? [a, b, (b + 5) % 12].map((x, j) => t(S(x), `${key}${j}`)).join(" ")
      : [a, b].map((x, j) => t(S(x), `${key}${j}`)).join(" ");
  };
  const urlFor = (base: string) => (e === 3 ? `/${base}/${slug(title)}`.replace(/(^.|\/.)/g, (c) => c.toUpperCase()) : e === 7 ? `/${base}/${slug(title).replace(/-/g, "_")}` : e === 11 ? `/${base}/${slug(title)}-${slug(S(e)["en-us"])}-${slug(S(e + 1)["en-us"])}` : `/${base}/${slug(title)}`);
  switch (ctUid) {
    case "campaign":
      return {
        title,
        hero: { title: t(H(e), "hero.title"), description: t(S(e), "hero.description") },
        seo_meta_description: master && e === 8 ? "" : metaDesc(e + 2, "seo"),
        cta_label: t(C(e), "cta"),
        highlights: [
          { _metadata: meta(`hl-${e}-a`), text: t(S(e + 4), "hl-a") },
          { _metadata: meta(`hl-${e}-b`), text: t(S(e + 6), "hl-b") },
        ],
        related_page: [ref("landing_page", e + 2)],
        hero_image: asset(e),
        url: urlFor("campaigns"),
        meta_title: metaTitle(e),
        hero_image_alt: e % 4 === 1 ? (master ? "" : t(H(e), "alt")) : t(H(e + 1), "alt"),
      };
    case "landing_page":
      return {
        title,
        hero_title: t(H(e + 1), "hero_title"),
        hero_description: t(S(e + 1), "hero_description"),
        cta_label: t(C(e + 1), "cta"),
        seo_description: master && e === 6 ? "" : metaDesc(e + 3, "seo"),
        sections: [{ feature: { _metadata: meta(`sec-${e}`), heading: t(H(e + 3), "sec-h"), copy: t(S(e + 5), "sec-c") } }],
        // product_story_02 is a deliberate hub: many landing pages feature it.
        featured_story: [ref("product_story", e % 3 === 0 ? 1 : e)],
        hero_image: asset(e + 1),
        url: urlFor("pages"),
        meta_title: metaTitle(e + 1),
      };
    case "product_story":
      return {
        title,
        headline: t(H(e + 2), "headline"),
        summary: t(S(e + 9), "summary"),
        key_features: [t(S(e + 4), "kf0"), t(S(e + 6), "kf1"), t(S(e + 8), "kf2")],
        cta_label: t(C(e + 2), "cta"),
        related_editorial: e < 10 ? [ref("editorial", e), ref("editorial", e + 4)] : [],
        gallery: e % 5 === 0 ? [] : [asset(e), asset(e + 2)],
        sku: `SKU-${String(e + 100)}`,
      };
    default: {
      // Body shape varies on purpose: structured+long, long without headings, thin, one huge paragraph.
      const para = (i: number, n = 3) => Array.from({ length: n }, (_, j) => t(S(e + i * 3 + j), `bp${i}-${j}`)).join(" ");
      const shape = e % 3;
      let blocks: RteBlock[];
      if (e === 6) blocks = [Array.from({ length: 20 }, (_, j) => t(S(e + j), `huge${j}`)).join(" "), para(1)];
      else if (shape === 0) blocks = [para(0), { h: 2, text: t(H(e), "bh0") }, para(1), para(2), { h: e === 9 ? 4 : 2, text: t(H(e + 1), "bh1") }, para(3), para(4), para(5)];
      else if (shape === 1) blocks = Array.from({ length: 12 }, (_, i) => para(i));
      else blocks = [para(0), para(1)];
      if (e % 4 === 1) blocks[0] = { link: "click here", text: para(0, 2) };
      return {
        title,
        url: urlFor("journal"),
        meta_title: metaTitle(e + 4),
        published: new Date(Date.UTC(2026, 9, 1) - e * 60 * 86_400_000).toISOString(),
        byline: e % 6 === 5 ? "" : "Staff writer",
        headline: t(H(e + 4), "headline"),
        standfirst: t(S(e + 7), "standfirst"),
        body: rte(blocks, e % 4 === 0 ? ref("product_story", e) : undefined),
        seo_description: master && e === 2 ? "" : metaDesc(e + 5, "seo"),
        // editorial_06 points at a campaign that no longer exists: a broken reference to detect.
        related_campaign: e === 5 ? [{ uid: "campaign_99", _content_type_uid: "campaign" }] : e < 10 ? [ref("campaign", e + 1)] : [],
        cover: asset(e + 3),
        cover_alt: e % 3 === 2 ? (master ? "" : t(H(e), "calt")) : t(H(e + 2), "calt"),
      };
    }
  }
}

/** First translatable field per type that gets an approval baseline in the fixtures (stale seeds). */
const BASELINE_FIELD: Record<string, string> = {
  campaign: "hero.description", landing_page: "hero_description", product_story: "summary", editorial: "standfirst",
};

export interface DemoWorld {
  sourceEntries: NormalizedEntry[];
  presence: Map<string, string[]>;
  targets: Map<string, NormalizedEntry>;
  baselines: Map<string, string>;
}

export function buildDemoWorld(): DemoWorld {
  const sourceEntries: NormalizedEntry[] = [];
  const presence = new Map<string, string[]>();
  const targets = new Map<string, NormalizedEntry>();
  const baselines = new Map<string, string>();

  DEMO_CONTENT_TYPES.forEach((ct, ci) => {
    for (let e = 0; e < ENTRIES_PER_TYPE; e++) {
      const uid = `${ct.uid}_${String(e + 1).padStart(2, "0")}`;
      const values = content(ct.uid, e, (p) => p[DEMO_MASTER], true);
      const campaign =
        ct.uid === "campaign"
          ? { id: `CMP-${String(e + 1).padStart(2, "0")}`, launchDate: e < 3 ? `2026-10-${27 + e}` : `2026-12-${String(1 + e).padStart(2, "0")}` }
          : undefined;
      sourceEntries.push({
        uid, contentTypeUid: ct.uid, title: ENTRY_TITLES[e] as string, locale: DEMO_MASTER, version: 2 + (e % 3),
        updatedAt: `2026-10-${String(1 + ((e * 2) % 18)).padStart(2, "0")}T09:00:00.000Z`,
        values, publishedEnvironments: [DEMO_ENV_UID], publicationKnown: true, campaign,
      });

      const localized: string[] = [];
      for (const loc of LOCALE_META.filter((l) => l.code !== DEMO_MASTER)) {
        // Forced fixture for the demo story: the first campaign is not localized in Italy.
        const forced = ct.uid === "campaign" && e === 0 && loc.code === "it-it";
        const notLocalized = forced || hash(ci, e, loc.code, "nl") < (NOT_LOCALIZED_RATE[loc.code] ?? 5);
        if (notLocalized) continue;
        localized.push(loc.code);

        const tr: Translator = (phrase, key) => {
          const r = hash(ct.uid, e, loc.code, key);
          const miss = MISSING_RATE[loc.code] ?? MISSING_RATE.default ?? 5;
          const same = UNTRANSLATED_RATE[loc.code] ?? UNTRANSLATED_RATE.default ?? 3;
          if (r < miss) return "";
          if (r < miss + same) return phrase[DEMO_MASTER];
          const out = phrase[loc.code as DemoLocale];
          if (loc.code === "de-de" && out.includes("{{firstName}}") && hash(e, "ph") < 60) return out.replace("{{firstName}}", "{{vorname}}");
          return out;
        };
        const target: NormalizedEntry = {
          uid, contentTypeUid: ct.uid, title: ENTRY_TITLES[e] as string, locale: loc.code,
          version: 1 + hash(ci, e, loc.code, "v") % 5,
          values: content(ct.uid, e, tr),
          publishedEnvironments: hash(ci, e, loc.code, "pub") < 12 ? [] : [DEMO_ENV_UID],
          publicationKnown: true,
        };
        targets.set(`${ct.uid}/${uid}/${loc.code}`, target);

        if (hash(ci, e, loc.code, "stale") < 9) {
          const path = BASELINE_FIELD[ct.uid] as string;
          const src = sourceTextAt(values, path);
          if (src) baselines.set(`${ct.uid}/${uid}/${loc.code}/${path}`, fingerprint(`${src} (earlier wording)`));
        }
      }
      presence.set(`${ct.uid}/${uid}`, localized);
    }
  });
  return { sourceEntries, presence, targets, baselines };
}

function sourceTextAt(values: Record<string, unknown>, path: string): string | undefined {
  let cur: unknown = values;
  for (const part of path.split(".")) cur = (cur as Record<string, unknown> | undefined)?.[part];
  return typeof cur === "string" ? cur : undefined;
}
