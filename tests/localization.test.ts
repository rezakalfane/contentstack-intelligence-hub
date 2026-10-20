import { describe, expect, it } from "vitest";
import { buildUnits, deriveDiagnostics } from "@/lib/domain/rules";
import { coverage, healthScore } from "@/lib/domain/scoring";
import { entry, fingerprint, input } from "./helpers";

const NOW = new Date("2026-10-20T00:00:00Z");
const policy = { criticalLocales: ["fr-fr"], now: NOW };

describe("locale presence / fallback semantics", () => {
  it("fallback-only entries are never counted as localized", () => {
    const i = input({ presence: new Map([["page/e1", new Map([["fr-fr", false]])]]) });
    const { units } = buildUnits(i);
    expect(units.length).toBeGreaterThan(0);
    expect(units.every((u) => u.existence === "fallback_only" && u.completeness === "missing")).toBe(true);
    expect(coverage(units).percent).toBe(0);
  });

  it("unknown presence (scan failure) is excluded, not assumed complete", () => {
    const i = input({ presence: new Map() });
    const { units, entryLocales } = buildUnits(i);
    expect(units).toHaveLength(0);
    expect(entryLocales[0]?.existence).toBe("unknown");
    expect(coverage(units).percent).toBeNull(); // N/A, never 100%
  });

  it("explicitly localized, non-empty, translated fields are complete", () => {
    const target = entry({ locale: "fr-fr", values: { title: "Bonjour mon ami", subtitle: "Deuxième ligne de texte ici" } });
    const { units } = buildUnits(input({ targets: new Map([["page/e1/fr-fr", target]]) }));
    expect(units.map((u) => u.completeness)).toEqual(["complete", "complete"]);
    expect(coverage(units).percent).toBe(100);
  });
});

describe("schema-aware eligibility", () => {
  it("excludes non-localizable, enum and identifier fields", () => {
    const target = entry({ locale: "fr-fr", values: { title: "Bonjour mon ami", subtitle: "Deuxième ligne de texte ici", sku_code: "A-1" } });
    const { units } = buildUnits(input({ targets: new Map([["page/e1/fr-fr", target]]) }));
    expect(units.map((u) => u.pointer.fieldPath).sort()).toEqual(["subtitle", "title"]);
  });

  it("whitespace-only localized value is missing", () => {
    const target = entry({ locale: "fr-fr", values: { title: "   ", subtitle: "Deuxième ligne de texte ici" } });
    const { units } = buildUnits(input({ targets: new Map([["page/e1/fr-fr", target]]) }));
    expect(units.find((u) => u.pointer.fieldPath === "title")?.completeness).toBe("missing");
  });

  it("value identical to a multi-word source is flagged incomplete (possibly untranslated)", () => {
    const target = entry({ locale: "fr-fr", values: { title: "Hello there my friend", subtitle: "Deuxième ligne de texte ici" } });
    const { units } = buildUnits(input({ targets: new Map([["page/e1/fr-fr", target]]) }));
    expect(units.find((u) => u.pointer.fieldPath === "title")?.completeness).toBe("incomplete");
  });

  it("eligible=0 yields N/A", () => {
    expect(coverage([]).percent).toBeNull();
  });
});

describe("freshness", () => {
  const target = entry({ locale: "fr-fr", values: { title: "Bonjour mon ami", subtitle: "Deuxième ligne de texte ici" } });
  const targets = new Map([["page/e1/fr-fr", target]]);

  it("no approval baseline => unknown, not stale", () => {
    const { units } = buildUnits(input({ targets }));
    expect(units.every((u) => u.freshness === "unknown")).toBe(true);
  });

  it("different approved fingerprint => stale; same => current", () => {
    const key = "page/e1/fr-fr/title";
    const stale = buildUnits(input({ targets, baselines: new Map([[key, fingerprint("old source")]]) })).units;
    expect(stale.find((u) => u.key === key)?.freshness).toBe("stale");
    const current = buildUnits(input({ targets, baselines: new Map([[key, fingerprint("Hello there my friend")]]) })).units;
    expect(current.find((u) => u.key === key)?.freshness).toBe("current");
  });
});

describe("diagnostics and scoring", () => {
  it("mandatory missing field is critical; optional is not", () => {
    const { units, entryLocales } = buildUnits(input({ presence: new Map([["page/e1", new Map([["fr-fr", false]])]]) }));
    const d = deriveDiagnostics(units, entryLocales, policy);
    expect(d.find((x) => x.pointer.fieldPath === "title")?.severity).toBe("critical");
    expect(d.find((x) => x.pointer.fieldPath === "subtitle")?.severity).not.toBe("critical");
  });

  it("score is monotonic when an issue is resolved", () => {
    const { units, entryLocales } = buildUnits(input({ presence: new Map([["page/e1", new Map([["fr-fr", false]])]]) }));
    const d = deriveDiagnostics(units, entryLocales, policy);
    const before = healthScore(d, units.length) as number;
    const after = healthScore(d.slice(1), units.length) as number;
    expect(after).toBeGreaterThanOrEqual(before);
    expect(healthScore([], 0)).toBeNull();
  });

  it("placeholder mismatch raises LOC-004", () => {
    const i = input({ sourceEntries: [entry({ values: { title: "Hi {{name}}, welcome back", subtitle: "Second line of copy here" } })] });
    const target = entry({ locale: "fr-fr", values: { title: "Salut {{nom}}, bon retour", subtitle: "Deuxième ligne de texte ici" } });
    i.targets = new Map([["page/e1/fr-fr", target]]);
    const { units, entryLocales } = buildUnits(i);
    const d = deriveDiagnostics(units, entryLocales, policy);
    expect(d.find((x) => x.pointer.fieldPath === "title")?.ruleIds).toContain("LOC-004");
  });

  it("PUB-001 only when source is published, target exists and is unpublished", () => {
    const i = input({
      environmentUid: "env1",
      sourceEntries: [entry({ publicationKnown: true, publishedEnvironments: ["env1"], values: { title: "Hello there my friend" } })],
      targets: new Map([["page/e1/fr-fr", entry({ locale: "fr-fr", publicationKnown: true, publishedEnvironments: [], values: { title: "Bonjour mon ami" } })]]),
    });
    const { units, entryLocales } = buildUnits(i);
    const d = deriveDiagnostics(units, entryLocales, policy);
    expect(d.some((x) => x.ruleIds.includes("PUB-001"))).toBe(true);
  });
});

import { APP_HOSTS, csLinks } from "@/lib/domain/cs-links";
describe("Contentstack deep links", () => {
  const b = { host: APP_HOSTS.eu as string, stackKey: "blt123", branch: "main" };
  it("builds entry, list, dashboard and language URLs and encodes segments", () => {
    expect(csLinks.entry(b, "product_spotlight", "fr-fr", "bltabc")).toBe("https://eu-app.contentstack.com/#!/stack/blt123/content-type/product_spotlight/fr-fr/entry/bltabc/edit?branch=main");
    expect(csLinks.entries(b, "faq", "en-us")).toContain("/content-type/faq/en-us/entries?branch=main");
    expect(csLinks.dashboard({ ...b, branch: undefined })).toBe("https://eu-app.contentstack.com/#!/stack/blt123/dashboard");
    expect(csLinks.entry(b, "a/b", "fr-fr", "x y")).toContain("a%2Fb");
    expect(csLinks.languages(b)).toContain("/settings/languages");
  });
});
