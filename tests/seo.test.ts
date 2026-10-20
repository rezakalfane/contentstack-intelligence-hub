import { describe, expect, it } from "vitest";
import { applyTextOverrides, auditSeo, extractSeoFacts, scoreSeo } from "@/lib/domain/seo";
import type { NormalizedContentType, SchemaField } from "@/lib/domain/types";
import { entry, field } from "./helpers";

const f = (uid: string, o: Partial<SchemaField> = {}) => field(uid, o);
const rte = (...nodes: unknown[]) => ({ type: "doc", children: nodes });
const p = (t: string) => ({ type: "p", children: [{ text: t }] });
const h = (n: number, t: string) => ({ type: `h${n}`, children: [{ text: t }] });
const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");

const BLOG: NormalizedContentType = {
  uid: "blog", title: "Blog",
  schema: [
    f("title"), f("url"), f("author", { dataType: "reference", referenceTo: ["author"] }), f("date", { dataType: "isodate" }),
    f("featured_image", { dataType: "file" }), f("featured_image_alt"),
    f("seo", { dataType: "global_field", schema: [f("meta_title"), f("meta_description"), f("enable_search_indexing", { dataType: "boolean" })] }),
    f("content", { dataType: "blocks", multiple: true, blocks: [
      { uid: "text", displayName: "Text", schema: [f("text", { dataType: "json" })] },
      { uid: "image", displayName: "Image", schema: [f("image", { dataType: "file" }), f("alt")] },
    ] }),
  ],
};
const FAQ: NormalizedContentType = { uid: "faq", title: "FAQ", schema: [f("title"), f("answer", { dataType: "json" })] };
const NOW = new Date("2026-10-20T00:00:00Z");

const blog = (over: Record<string, unknown> = {}, uid = "b1", title = "Post") =>
  entry({ uid, contentTypeUid: "blog", title, values: {
    title, url: "/blog/good-post", author: [{ uid: "a1" }], date: "2026-09-01T00:00:00Z", featured_image: { uid: "i1" }, featured_image_alt: "A battery on a workshop bench",
    seo: { meta_title: `A well sized meta title for post ${uid}`, meta_description: `${uid}: ` + "x".repeat(120), enable_search_indexing: true },
    content: [{ text: { _metadata: { uid: "t1" }, text: rte(p(words(100)), p(words(100)), h(2, "Section"), p(words(100)), p(words(50))) } }],
    ...over,
  } });

const audit = (entries: ReturnType<typeof blog>[], cts = [BLOG]) => {
  const facts = entries.map((e) => extractSeoFacts(cts.find((c) => c.uid === e.contentTypeUid)!, e));
  return { facts, findings: auditSeo(facts, NOW) };
};
const rules = (fs: { ruleId: string }[]) => fs.map((x) => x.ruleId).sort();

describe("SEO facts", () => {
  it("classifies from the schema and finds nested fields via global fields and blocks", () => {
    const { facts } = audit([blog()]);
    const x = facts[0]!;
    expect(x).toMatchObject({ pageLike: true, articleLike: true, faqLike: false });
    expect(x.metaTitle?.path).toBe("seo.meta_title");
    expect(x.metaDescription?.source).toBe("meta");
    expect(x.body.headings).toEqual([2]);
    expect(x.body.words).toBeGreaterThan(300);
  });
});

describe("SEO rules", () => {
  it("a healthy article has no findings", () => {
    expect(audit([blog()]).findings).toEqual([]);
  });

  it("meta description: empty is high + proposable (generate); too short/long is medium (rewrite)", () => {
    const empty = audit([blog({ seo: { meta_title: "A well sized meta title for this post", meta_description: "" } })]).findings;
    expect(empty).toHaveLength(1);
    expect(empty[0]).toMatchObject({ ruleId: "SEO-001", severity: "high", proposable: true, suggestion: { kind: "generate", target: "meta_description" } });
    expect(rules(audit([blog({ seo: { meta_title: "A well sized meta title for this post", meta_description: "Too short" } })]).findings)).toEqual(["SEO-002"]);
    expect(rules(audit([blog({ seo: { meta_title: "A well sized meta title for this post", meta_description: "y".repeat(200) } })]).findings)).toEqual(["SEO-002"]);
  });

  it("meta title length and duplicates across entries", () => {
    expect(rules(audit([blog({ seo: { meta_title: "z".repeat(80), meta_description: "x".repeat(120) } })]).findings)).toEqual(["SEO-003"]);
    const { findings } = audit([
      blog({ seo: { meta_title: "Same title for both posts", meta_description: "x".repeat(110) } }, "b1", "One"),
      blog({ seo: { meta_title: "Same title for both posts", meta_description: "y".repeat(110) } }, "b2", "Two"),
    ]);
    expect(findings.filter((x) => x.ruleId === "SEO-004" && x.fieldLabel === "Meta title")).toHaveLength(2);
    expect(findings.find((x) => x.ruleId === "SEO-004")!.evidence[0]).toMatch(/Also used by/);
  });

  it("URL quality", () => {
    const r = audit([blog({ url: "/Blog/My_Post?x=1" })]).findings.filter((x) => x.ruleId === "SEO-005");
    expect(r).toHaveLength(1);
    expect(r[0]!.evidence.join(" ")).toMatch(/uppercase.*underscores.*query/);
  });

  it("alt text: empty alt on an instance and a schema with no alt field", () => {
    const withImg = blog({ content: [{ image: { _metadata: { uid: "g1" }, image: { uid: "a" }, alt: "" } }] });
    expect(audit([withImg]).findings.some((x) => x.ruleId === "SEO-007" && x.title === "Post")).toBe(true);
    const ok = blog({ content: [{ image: { _metadata: { uid: "g1" }, image: { uid: "a" }, alt: "A battery on a bench" } }] });
    expect(audit([ok]).findings.some((x) => x.ruleId === "SEO-007" && x.entryId !== "ct:blog")).toBe(false);
    // an image field with no alt-text field in the schema → one schema-level finding for the content type
    const NOALT: NormalizedContentType = { uid: "blog", title: "Blog", schema: [...BLOG.schema.filter((x) => x.uid !== "featured_image_alt")] };
    const gap = audit([blog()], [NOALT]).findings.filter((x) => x.ruleId === "SEO-007");
    expect(gap).toHaveLength(1);
    expect(gap[0]).toMatchObject({ entryId: "ct:blog", severity: "low" });
  });

  it("headings: long body without subheadings, multiple H1, skipped levels; thin content", () => {
    const long = blog({ content: [{ text: { text: rte(p(words(400))) } }] });
    expect(audit([long]).findings.map((x) => x.ruleId)).toEqual(expect.arrayContaining(["SEO-008"]));
    const skip = blog({ content: [{ text: { text: rte(p(words(100)), p(words(100)), h(2, "a"), p(words(120)), h(4, "b")) } }] });
    expect(audit([skip]).findings.find((x) => x.ruleId === "SEO-008")!.evidence.join()).toMatch(/skipped/);
    const thin = blog({ content: [{ text: { text: rte(p(words(40))) } }] });
    expect(audit([thin]).findings.some((x) => x.ruleId === "SEO-009")).toBe(true);
  });

  it("AI rules: generic links, authorship, freshness, schema.org readiness", () => {
    const link = { type: "p", children: [{ text: "see " }, { type: "a", attrs: { url: "/x" }, children: [{ text: "click here" }] }] };
    const r = audit([blog({ content: [{ text: { text: rte(link, p(words(100)), p(words(100)), h(2, "s"), p(words(120))) } }], author: [], date: "2022-01-01T00:00:00Z", featured_image: undefined })]).findings;
    expect(rules(r)).toEqual(expect.arrayContaining(["AIO-002", "AIO-004", "AIO-005", "AIO-006"]));
    expect(r.find((x) => x.ruleId === "AIO-004")!.evidence[0]).toMatch(/author.*image/);
  });

  it("FAQ answer-first", () => {
    const e = entry({ uid: "q1", contentTypeUid: "faq", title: "How long?", values: { title: "How long?", answer: rte(p(words(90))) } });
    const r = audit([e], [FAQ]).findings;
    expect(r.map((x) => x.ruleId)).toContain("AIO-001");
    const good = entry({ uid: "q2", contentTypeUid: "faq", title: "How long?", values: { title: "How long?", answer: rte(p("About two days. " + words(20))) } });
    expect(audit([good], [FAQ]).findings.filter((x) => x.ruleId === "AIO-001")).toEqual([]);
  });

  it("schema gap: page-like type with URLs but no meta fields", () => {
    const CT: NormalizedContentType = { uid: "landing", title: "Landing", schema: [f("title"), f("url")] };
    const e = entry({ uid: "l1", contentTypeUid: "landing", title: "L", values: { title: "L", url: "/l" } });
    const r = audit([e], [CT]).findings;
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ ruleId: "SEO-000", entryId: "ct:landing" });
  });
});

describe("SEO scoring and overlay", () => {
  it("score = 100 − penalties per entry, mean over applicable entries; N/A when nothing applies", () => {
    const bad = blog({ seo: { meta_title: "A well sized meta title for this post", meta_description: "" } }, "b1");
    const good = blog({}, "b2");
    const { facts, findings } = audit([bad, good]);
    const s = scoreSeo(facts, findings);
    expect(s.perEntry.get("blog/b1")!.seo).toBe(85); // one high finding = −15
    expect(s.perEntry.get("blog/b2")!.seo).toBe(100);
    expect(s.seo).toBe(93); // mean(85,100) rounded
    expect(scoreSeo([], []).seo).toBeNull();
  });

  it("applying a suggestion re-audits and resolves the finding; score cannot decrease", () => {
    const bad = blog({ seo: { meta_title: "A well sized meta title for this post", meta_description: "" } });
    const { facts, findings } = audit([bad]);
    const before = scoreSeo(facts, findings).seo!;
    const after = auditSeo(applyTextOverrides(facts, new Map([["blog/b1|seo.meta_description", "x".repeat(120)]])), NOW);
    expect(after.find((x) => x.ruleId === "SEO-001")).toBeUndefined();
    expect(scoreSeo(applyTextOverrides(facts, new Map([["blog/b1|seo.meta_description", "x".repeat(120)]])), after).seo!).toBeGreaterThanOrEqual(before);
  });
});

import { createDemoAdapter } from "@/lib/adapters/demo-adapter";
import { runScan } from "@/lib/scan/scan";

describe("demo SEO audit", () => {
  it("exercises most rules with a believable score", async () => {
    const snap = await runScan(createDemoAdapter(), { baselines: new Map(), maxEntriesPerType: 100, concurrency: 4, criticalLocales: [], provenance: "DEMO" });
    const facts = snap.seo!;
    const findings = auditSeo(facts, new Date("2026-10-20T00:00:00Z"));
    const rulesHit = new Set(findings.map((x) => x.ruleId));
    for (const r of ["SEO-001", "SEO-002", "SEO-003", "SEO-004", "SEO-005", "SEO-007", "SEO-008", "SEO-009", "AIO-002", "AIO-003", "AIO-004", "AIO-005", "AIO-006"]) expect(rulesHit.has(r), r).toBe(true);
    const s = scoreSeo(facts, findings);
    expect(s.seo).toBeGreaterThan(20);
    expect(s.seo).toBeLessThan(95);
    expect(s.ai).not.toBeNull();
    expect(findings.filter((x) => x.proposable).length).toBeGreaterThan(5);
  });
});

import { simulateSeoText } from "@/lib/demo/simulate-seo";
import { requestStructured } from "@/lib/ai/provider";
import { SEO_JSON_SCHEMA, SeoOutputSchema } from "@/lib/ai/seo-prompt";
import { buildSeoView } from "@/lib/scan/seo-view";
import { buildView } from "@/lib/scan/view";
import type { TranslationProposal } from "@/lib/domain/types";
import type { Env } from "@/lib/security/env";
import { vi } from "vitest";

describe("simulated SEO text", () => {
  const excerpt = "Autumn Collection. Meet the season with pieces made for everyday living. Explore our new collection of thoughtful essentials. Timeless design, considered in every detail.";
  it("generates within the target range from the excerpt, never beyond max", () => {
    const t = simulateSeoText({ target: "meta_description", current: "", entryTitle: "Autumn Collection", excerpt, min: 70, max: 155 });
    expect(t.length).toBeGreaterThanOrEqual(70);
    expect(t.length).toBeLessThanOrEqual(155);
  });
  it("shortens an over-long description at a word boundary and keeps titles within the limit", () => {
    const long = "word ".repeat(60).trim();
    const t = simulateSeoText({ target: "meta_description", current: long, entryTitle: "X", excerpt: "", min: 70, max: 155 });
    expect(t.length).toBeLessThanOrEqual(155);
    expect(t).not.toMatch(/wor$/);
    const title = simulateSeoText({ target: "meta_title", current: "A".repeat(10) + " " + "b".repeat(80), entryTitle: "X", excerpt: "", min: 30, max: 60 });
    expect(title.length).toBeLessThanOrEqual(60);
  });
});

describe("SEO suggestions and the rest of the app", () => {
  const seoProposal = (over: Partial<TranslationProposal> = {}): TranslationProposal => ({
    id: "p_seo", task: "seo", ruleId: "SEO-001", issueId: "x", unitKey: "seo:x", status: "approved", provenance: "simulated",
    pointer: { stackId: "", contentTypeUid: "campaign", entryUid: "campaign_09", locale: "en-us", fieldPath: "seo_meta_description" },
    sourceText: "", suggestedText: "A".repeat(100), model: "sim", promptVersion: "seo-v1", sourceFingerprint: "f",
    glossaryWarnings: [], placeholderWarnings: [], notes: [], updatedAt: "", ...over,
  });

  it("SEO proposals do not count toward translation KPIs", async () => {
    const snap = await runScan(createDemoAdapter(), { baselines: new Map(), maxEntriesPerType: 100, concurrency: 4, criticalLocales: [], provenance: "DEMO" });
    const view = buildView(snap, [seoProposal()], new Date());
    expect(view.kpis.proposals).toBe(0);
    expect(view.kpis.approved).toBe(0);
  });

  it("an applied (demo) suggestion resolves the finding and does not lower the score", async () => {
    const snap = await runScan(createDemoAdapter(), { baselines: new Map(), maxEntriesPerType: 100, concurrency: 4, criticalLocales: [], provenance: "DEMO" });
    const before = buildSeoView(snap, [], new Date())!;
    const target = before.open.find((f) => f.ruleId === "SEO-001")!;
    const p = seoProposal({
      id: "p1", issueId: target.id, unitKey: `seo:${target.id}`, appliedToDemo: true, editedText: "z".repeat(110) + " unique",
      pointer: { stackId: "", contentTypeUid: target.contentTypeUid, entryUid: target.entryUid!, locale: target.locale, fieldPath: target.fieldPath! },
    });
    const after = buildSeoView(snap, [p], new Date())!;
    expect(after.findings.find((f) => f.id === target.id)?.status).toBe("resolved");
    expect(after.open.length).toBe(before.open.length - 1);
    expect(after.scores.seo!).toBeGreaterThanOrEqual(before.scores.seo!);
    expect(after.proposals[target.id]?.id).toBe("p1");
  });

  it("the shared provider path validates SEO output and records usage", async () => {
    const env = { OPENAI_API_KEY: "sk", OPENAI_MODEL: "m-seo", OPENAI_REASONING_EFFORT: "low" } as unknown as Env;
    const res = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s });
    const ok = vi.fn<typeof fetch>(async (u) => (String(u).includes("/models/") ? res({}) : res({ output_text: JSON.stringify({ text: "A good description.", notes: ["check claim"] }), usage: { input_tokens: 90, output_tokens: 20 } })));
    const r = await requestStructured(env, { system: "s", user: "u", schemaName: "seo_text", jsonSchema: SEO_JSON_SCHEMA, zod: SeoOutputSchema }, ok);
    expect(r.output.text).toBe("A good description.");
    expect(r).toMatchObject({ inputTokens: 90, outputTokens: 20, reasoningEffort: "low" });
    const bad = vi.fn<typeof fetch>(async (u) => (String(u).includes("/models/") ? res({}) : res({ output_text: JSON.stringify({ text: 5 }) })));
    await expect(requestStructured({ ...env, OPENAI_MODEL: "m-seo2" } as Env, { system: "s", user: "u", schemaName: "seo_text", jsonSchema: SEO_JSON_SCHEMA, zod: SeoOutputSchema }, bad)).rejects.toMatchObject({ code: "invalid_output" });
  });
});
