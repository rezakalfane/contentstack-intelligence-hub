import { describe, expect, it, vi } from "vitest";
import { CmaClient, CmaError } from "@/lib/adapters/cma-client";
import { createLiveAdapter } from "@/lib/adapters/live-adapter";
import { applyReviewedProposal, setTextAtPath } from "@/lib/adapters/live-writer";
import { createDemoAdapter } from "@/lib/adapters/demo-adapter";
import { runScan } from "@/lib/scan/scan";
import { fingerprint } from "@/lib/domain/fingerprint";
import { evaluateWritePolicy } from "@/lib/security/write-policy";
import { probeModel, requestTranslation, AiError } from "@/lib/ai/provider";
import type { Env } from "@/lib/security/env";
import type { TranslationProposal } from "@/lib/domain/types";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
const client = (f: typeof fetch) => new CmaClient({ base: "https://eu-api.contentstack.com", apiKey: "k", token: "t", fetchImpl: f, baseDelayMs: 1 });

describe("CMA client", () => {
  it("retries 429 then succeeds, and never leaks credentials in errors", async () => {
    const f = vi.fn<typeof fetch>().mockResolvedValueOnce(json({}, 429, { "retry-after": "0" })).mockResolvedValueOnce(json({ ok: 1 }));
    expect(await client(f).get("/x")).toEqual({ ok: 1 });
    expect(f).toHaveBeenCalledTimes(2);
    const bad = vi.fn<typeof fetch>().mockResolvedValue(json({ error_message: "nope" }, 403));
    const err = await client(bad).get("/x").catch((e: CmaError) => e);
    expect(err).toBeInstanceOf(CmaError);
    expect((err as CmaError).kind).toBe("forbidden");
    expect((err as Error).message).not.toMatch(/\bt\b.*authorization|api_key/);
  });

  it("does not retry writes", async () => {
    const f = vi.fn<typeof fetch>().mockResolvedValue(json({}, 500));
    await expect(client(f).put("/x", {})).rejects.toBeInstanceOf(CmaError);
    expect(f).toHaveBeenCalledTimes(1);
  });
});

function fakeStack(opts: { failLocalesFor?: string } = {}) {
  const entries = Array.from({ length: 150 }, (_, i) => ({ uid: `e${i}`, title: `T${i}`, locale: "en-us", _version: 1, publish_details: [] }));
  const f = vi.fn<typeof fetch>(async (input) => {
    const url = new URL(String(input));
    const p = url.pathname.replace("/v3", "");
    if (p === "/locales") return json({ locales: [{ code: "en-us", fallback_locale: null }, { code: "fr-fr", fallback_locale: "en-us" }] });
    if (p === "/content_types") return json({ content_types: [{ uid: "page", title: "Page", schema: [{ uid: "title", data_type: "text", mandatory: true, display_name: "Title" }] }], count: 1 });
    if (p === "/content_types/page/entries") {
      const skip = Number(url.searchParams.get("skip") ?? 0);
      return json({ entries: entries.slice(skip, skip + 100), count: 150 });
    }
    const m = /entries\/(e\d+)\/locales$/.exec(p);
    if (m) {
      if (m[1] === opts.failLocalesFor) return json({ error_message: "boom" }, 400);
      return json({ locales: [{ code: "en-us" }, { code: "fr-fr", localized: m[1] === "e0" }] });
    }
    const one = /entries\/(e\d+)$/.exec(p);
    if (one) return json({ entry: { uid: one[1], title: "Bonjour", locale: url.searchParams.get("locale"), _version: 3 } });
    return json({}, 404);
  });
  return f;
}

describe("scan against a mocked CMA", () => {
  const adapterFor = (f: typeof fetch) => createLiveAdapter({ client: client(f), region: "eu", branch: "main" });
  const base = { baselines: new Map(), maxEntriesPerType: 1000, concurrency: 4, criticalLocales: [], provenance: "LIVE · Contentstack" };

  it("paginates, uses explicit /locales presence, and distinguishes localized from fallback", async () => {
    const snap = await runScan(adapterFor(fakeStack()), base);
    expect(snap.sourceEntryCount).toBe(150);
    expect(snap.status).toBe("complete");
    expect(snap.entryLocales.filter((e) => e.existence === "exists")).toHaveLength(1);
    expect(snap.entryLocales.filter((e) => e.existence === "fallback_only")).toHaveLength(149);
  });

  it("discloses partial failures instead of counting them complete", async () => {
    const snap = await runScan(adapterFor(fakeStack({ failLocalesFor: "e5" })), base);
    expect(snap.status).toBe("partial");
    expect(snap.errors.some((e) => e.scope.includes("e5"))).toBe(true);
    expect(snap.entryLocales.find((e) => e.entryUid === "e5")?.existence).toBe("unknown");
    expect(snap.units.some((u) => u.pointer.entryUid === "e5")).toBe(false);
  });

  it("applies and discloses the per-type entry limit", async () => {
    const snap = await runScan(adapterFor(fakeStack()), { ...base, maxEntriesPerType: 120 });
    expect(snap.sourceEntryCount).toBe(120);
    expect(snap.limits.join()).toMatch(/120/);
  });

  it("can be cancelled", async () => {
    const c = new AbortController();
    c.abort();
    await expect(runScan(adapterFor(fakeStack()), { ...base, signal: c.signal })).rejects.toThrow(/cancel/i);
  });

  it("demo fixtures satisfy the acceptance size: ≥5 locales, ≥4 types, ≥50 entries", async () => {
    const snap = await runScan(createDemoAdapter(), base);
    expect(snap.locales.length).toBeGreaterThanOrEqual(5);
    expect(snap.contentTypes.length).toBeGreaterThanOrEqual(4);
    expect(snap.sourceEntryCount).toBeGreaterThanOrEqual(50);
    expect(snap.units.some((u) => u.pointer.locale === "it-it" && u.completeness === "missing")).toBe(true);
  });
});

describe("write policy and guarded writer", () => {
  const env = { ENABLE_CMS_WRITES: false, CONTENTSTACK_WRITE_TOKEN: undefined, CMS_WRITE_ALLOWED_ENTRY_UIDS: undefined };
  it("is disabled by default and never allowed in demo", () => {
    expect(evaluateWritePolicy(env, "live", { entryUid: "e1" }, true).allowed).toBe(false);
    expect(evaluateWritePolicy({ ...env, ENABLE_CMS_WRITES: true, CONTENTSTACK_WRITE_TOKEN: "w", CMS_WRITE_ALLOWED_ENTRY_UIDS: "e1" }, "demo", { entryUid: "e1" }, true).allowed).toBe(false);
  });
  it("requires allowlisted entry and explicit confirmation", () => {
    const on = { ...env, ENABLE_CMS_WRITES: true, CONTENTSTACK_WRITE_TOKEN: "w", CMS_WRITE_ALLOWED_ENTRY_UIDS: "e1" };
    expect(evaluateWritePolicy(on, "live", { entryUid: "e2" }, true).allowed).toBe(false);
    expect(evaluateWritePolicy(on, "live", { entryUid: "e1" }, false).allowed).toBe(false);
    expect(evaluateWritePolicy(on, "live", { entryUid: "e1" }, true).allowed).toBe(true);
  });

  it("setTextAtPath merges one leaf by instance id and leaves the rest untouched", () => {
    const body = { title: "t", steps: [{ _metadata: { uid: "a" }, step_title: "x", other: 1 }, { _metadata: { uid: "b" }, step_title: "y" }] };
    expect(setTextAtPath(body, "steps[uid=b].step_title", "Z")).toBe(true);
    expect(body.steps[1]?.step_title).toBe("Z");
    expect(body.steps[0]).toEqual({ _metadata: { uid: "a" }, step_title: "x", other: 1 });
    expect(setTextAtPath(body, "steps[uid=nope].step_title", "Z")).toBe(false);
  });

  const proposal = (over: Partial<TranslationProposal> = {}): TranslationProposal => ({
    id: "p", issueId: "d", unitKey: "k", status: "approved", provenance: "openai",
    pointer: { stackId: "s", contentTypeUid: "page", entryUid: "e0", locale: "fr-fr", fieldPath: "title" },
    sourceText: "T0", suggestedText: "Nouveau", model: "m", promptVersion: "v", sourceFingerprint: fingerprint("T0"),
    cmsVersionAtProposal: 3, glossaryWarnings: [], placeholderWarnings: [], notes: [], updatedAt: "", ...over,
  });
  const wenv = { ENABLE_CMS_WRITES: true, CONTENTSTACK_WRITE_TOKEN: "w", CMS_WRITE_ALLOWED_ENTRY_UIDS: "e0" };

  it("refuses with 409-style conflict when the CMS version moved, and does not PUT", async () => {
    const f = fakeStack();
    const put = vi.fn();
    const writeClient = { put } as unknown as CmaClient;
    const adapter = createLiveAdapter({ client: client(f), region: "eu" });
    const r = await applyReviewedProposal({ env: wenv, mode: "live", adapter, writeClient }, proposal({ cmsVersionAtProposal: 2 }), true);
    expect(r).toMatchObject({ ok: false, code: "conflict" });
    expect(put).not.toHaveBeenCalled();
  });

  it("refuses when the source changed since the proposal", async () => {
    const adapter = createLiveAdapter({ client: client(fakeStack()), region: "eu" });
    const r = await applyReviewedProposal({ env: wenv, mode: "live", adapter, writeClient: { put: vi.fn() } as unknown as CmaClient }, proposal({ sourceFingerprint: "stale" }), true);
    expect(r).toMatchObject({ ok: false, code: "conflict" });
  });

  it("fails when read-back does not match (mock returns old text)", async () => {
    const put = vi.fn().mockResolvedValue({});
    const adapter = createLiveAdapter({ client: client(fakeStack()), region: "eu" });
    const r = await applyReviewedProposal({ env: wenv, mode: "live", adapter, writeClient: { put } as unknown as CmaClient }, proposal(), true);
    expect(put).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ ok: false, code: "failed" });
    expect((r as { message: string }).message).toMatch(/read-back/);
  });
});

describe("OpenAI provider (mocked)", () => {
  const env = { OPENAI_API_KEY: "sk", OPENAI_MODEL: "m1", OPENAI_REASONING_EFFORT: "low" } as unknown as Env;
  const req = { sourceLocale: "en-us", targetLocale: "fr-fr", contentType: "Page", fieldLabel: "Title", sourceText: "Hello {{name}}" };
  const out = { translatedText: "Bonjour {{name}}", glossaryWarnings: [], placeholderWarnings: [], notes: [], confidenceLabel: "high" };

  it("fails closed when the model is unavailable, without calling /responses", async () => {
    const f = vi.fn<typeof fetch>(async (u) => (String(u).includes("/models/") ? json({}, 404) : json({ data: [{ id: "gpt-x" }] })));
    await expect(requestTranslation({ ...env, OPENAI_MODEL: "nope" } as Env, req, f)).rejects.toMatchObject({ code: "model_unavailable" });
    expect(f.mock.calls.some(([u]) => String(u).endsWith("/responses"))).toBe(false);
  });

  it("parses structured output and reports usage", async () => {
    const f = vi.fn<typeof fetch>(async (u) => (String(u).includes("/models/") ? json({ id: "m2" }) : json({ output_text: JSON.stringify(out), usage: { input_tokens: 40, output_tokens: 9 } })));
    const r = await requestTranslation({ ...env, OPENAI_MODEL: "m2" } as Env, req, f);
    expect(r).toMatchObject({ model: "m2", inputTokens: 40, outputTokens: 9 });
    const body = JSON.parse(String((f.mock.calls.at(-1)?.[1] as RequestInit).body));
    expect(body.reasoning).toEqual({ effort: "low" });
    expect(body.store).toBe(false);
  });

  it("sends the env effort and reports it with reasoning tokens", async () => {
    const f = vi.fn<typeof fetch>(async (u) => (String(u).includes("/models/") ? json({}) : json({ output_text: JSON.stringify(out), usage: { input_tokens: 5, output_tokens: 50, output_tokens_details: { reasoning_tokens: 30 } } })));
    const r = await requestTranslation({ ...env, OPENAI_MODEL: "m5", OPENAI_REASONING_EFFORT: "high" } as Env, req, f);
    expect(JSON.parse(String((f.mock.calls.at(-1)?.[1] as RequestInit).body)).reasoning).toEqual({ effort: "high" });
    expect(r).toMatchObject({ reasoningEffort: "high", reasoningTokens: 30 });
    const none = vi.fn<typeof fetch>(async (u) => (String(u).includes("/models/") ? json({}) : json({ output_text: JSON.stringify(out) })));
    await requestTranslation({ ...env, OPENAI_MODEL: "m6", OPENAI_REASONING_EFFORT: undefined } as Env, req, none);
    expect(JSON.parse(String((none.mock.calls.at(-1)?.[1] as RequestInit).body)).reasoning).toBeUndefined();
  });

  it("rejects schema-invalid output and unsupported reasoning params without silent fallback", async () => {
    const bad = vi.fn<typeof fetch>(async (u) => (String(u).includes("/models/") ? json({}) : json({ output_text: JSON.stringify({ translatedText: 1 }) })));
    await expect(requestTranslation({ ...env, OPENAI_MODEL: "m3" } as Env, req, bad)).rejects.toMatchObject({ code: "invalid_output" });
    const unsupported = vi.fn<typeof fetch>(async (u) => (String(u).includes("/models/") ? json({}) : json({ error: { message: "Unsupported parameter: reasoning.effort" } }, 400)));
    const e = await requestTranslation({ ...env, OPENAI_MODEL: "m4" } as Env, req, unsupported).catch((x: AiError) => x);
    expect(e).toMatchObject({ code: "unsupported_parameter" });
  });

  it("probe reports a missing key without any network call", async () => {
    const f = vi.fn<typeof fetch>();
    expect((await probeModel({ ...env, OPENAI_API_KEY: undefined } as Env, f)).ok).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
});

import { getTextAtPath, minimalUpdateBody, restoreTextAtPath } from "@/lib/domain/path";
describe("restore helpers", () => {
  it("re-inserts items the CMS compacted out of a multi-value text field, in index order", () => {
    const body = { key_features: ["b", "d"], title: "t" }; // original ["a","b","c","d"]; a and c were blanked and dropped
    expect(restoreTextAtPath(body, "key_features[0]", "a")).toBe(true);
    expect(restoreTextAtPath(body, "key_features[2]", "c")).toBe(true);
    expect(body.key_features).toEqual(["a", "b", "c", "d"]);
  });
  it("restores a blanked leaf in place and reads it back", () => {
    const body = { hero: { title: "" } };
    expect(restoreTextAtPath(body, "hero.title", "Salut")).toBe(true);
    expect(getTextAtPath(body, "hero.title")).toBe("Salut");
  });
  it("sends assets as uids and only touched top-level fields", () => {
    const body = minimalUpdateBody({ title: "x", img: { uid: "a1", url: "u", filename: "f" }, other: "y" }, ["title", "img.x"]);
    expect(body).toEqual({ title: "x", img: "a1" });
  });
});
