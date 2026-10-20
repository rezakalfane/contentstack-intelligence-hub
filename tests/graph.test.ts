import { describe, expect, it } from "vitest";
import { createDemoAdapter } from "@/lib/adapters/demo-adapter";
import { adjacency, buildGraph, dependencies, dependents, extractRefs, graphStats } from "@/lib/domain/graph";
import { runScan } from "@/lib/scan/scan";
import type { NormalizedContentType, NormalizedEntry, SchemaField } from "@/lib/domain/types";
import { entry, field } from "./helpers";

const refField = (uid: string, to: string[], o: Partial<SchemaField> = {}) => field(uid, { dataType: "reference", referenceTo: to, ...o });

const CT: NormalizedContentType[] = [
  {
    uid: "page", title: "Page",
    schema: [
      field("title"),
      refField("related", ["page", "faq"], { multiple: true }),
      field("image", { dataType: "file" }),
      field("body", { dataType: "json" }),
      field("hero", { dataType: "group", schema: [refField("cta_target", ["faq"]), field("bg", { dataType: "file" })] }),
      field("blocks", { dataType: "blocks", blocks: [{ uid: "teaser", displayName: "Teaser", schema: [refField("page_ref", ["page"])] }] }),
    ],
  },
  { uid: "faq", title: "FAQ", schema: [field("title")] },
];

const e = (ct: string, uid: string, values: Record<string, unknown>): NormalizedEntry => entry({ uid, contentTypeUid: ct, title: uid, values });

describe("reference extraction", () => {
  it("finds references in reference fields, groups, blocks, RTE embeds and files", () => {
    const refs = extractRefs(CT[0]!.schema, {
      related: [{ uid: "f1", _content_type_uid: "faq" }, "p2"],
      image: { uid: "a1", filename: "x.jpg", url: "u" },
      body: { type: "doc", children: [{ type: "reference", attrs: { type: "entry", "entry-uid": "f2", "content-type-uid": "faq" }, children: [{ text: "" }] }, { type: "reference", attrs: { type: "asset", "asset-uid": "a2" }, children: [] }] },
      hero: { cta_target: [{ uid: "f3", _content_type_uid: "faq" }], bg: "a3" },
      blocks: [{ teaser: { _metadata: { uid: "b1" }, page_ref: [{ uid: "p9", _content_type_uid: "page" }] } }],
    });
    expect(refs.map((r) => `${r.kind}:${r.uid}:${r.via}`).sort()).toEqual([
      "asset:a1:asset", "asset:a2:rte", "asset:a3:asset", "entry:f1:reference", "entry:f2:rte", "entry:f3:reference", "entry:p2:reference", "entry:p9:reference",
    ]);
    expect(refs.find((r) => r.uid === "a1")?.assetName).toBe("x.jpg");
  });
});

describe("graph", () => {
  const entries = [
    e("page", "a", { related: [{ uid: "b", _content_type_uid: "page" }] }),
    e("page", "b", { related: [{ uid: "c", _content_type_uid: "page" }] }),
    e("page", "c", { related: [{ uid: "a", _content_type_uid: "page" }], hero: { cta_target: [{ uid: "ghost", _content_type_uid: "faq" }] } }), // cycle a→b→c→a, broken ref to ghost
    e("page", "solo", {}),
    e("faq", "f", {}),
  ];
  const g = buildGraph({ contentTypes: CT, entries, completeTypes: new Set(["page", "faq"]) });
  const adj = adjacency(g);

  it("computes transitive blast radius with depths, safely through cycles", () => {
    const d = dependents(adj, "page/c");
    expect(Object.fromEntries(d)).toEqual({ "page/b": 1, "page/a": 2 });
    expect(dependents(adj, "page/solo").size).toBe(0);
    expect(dependencies(adj, "page/a").get("page/c")).toBe(2);
  });

  it("flags references to entries that do not exist as broken (only for fully scanned types)", () => {
    expect(graphStats(g).broken.map((n) => n.uid)).toEqual(["ghost"]);
    const partial = buildGraph({ contentTypes: CT, entries, completeTypes: new Set(["page"]) });
    expect(partial.nodes.find((n) => n.uid === "ghost")).toMatchObject({ kind: "entry", unscanned: true });
    expect(graphStats(partial).broken).toHaveLength(0);
  });

  it("reports orphans and hubs", () => {
    const s = graphStats(g);
    expect(s.orphans.map((n) => n.uid).sort()).toEqual(["f", "solo"]);
    expect(s.hubs[0]?.transitive).toBe(2);
  });
});

describe("demo graph", () => {
  it("is large enough to be interesting and includes a hub, orphans, assets and one broken reference", async () => {
    const snap = await runScan(createDemoAdapter(), { baselines: new Map(), maxEntriesPerType: 100, concurrency: 4, criticalLocales: [], provenance: "DEMO" });
    const s = graphStats(snap.graph!);
    expect(s.entries).toBeGreaterThanOrEqual(50);
    expect(s.assets).toBeGreaterThan(3);
    expect(s.edges).toBeGreaterThan(100);
    expect(s.broken.map((n) => n.uid)).toEqual(["campaign_99"]);
    expect(s.orphans.length).toBeGreaterThan(0);
    expect(s.hubs[0]!.transitive).toBeGreaterThan(8);
  });
});
