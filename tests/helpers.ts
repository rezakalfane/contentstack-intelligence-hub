import { fingerprint } from "@/lib/domain/fingerprint";
import type { AnalysisInput } from "@/lib/domain/rules";
import type { NormalizedContentType, NormalizedEntry, SchemaField } from "@/lib/domain/types";

export const field = (uid: string, o: Partial<SchemaField> = {}): SchemaField => ({
  uid, displayName: uid, dataType: "text", mandatory: false, multiple: false, nonLocalizable: false, hasEnum: false, ...o,
});

export const CT: NormalizedContentType = {
  uid: "page",
  title: "Page",
  schema: [
    field("title", { mandatory: true }),
    field("subtitle"),
    field("sku_code", { nonLocalizable: true }),
    field("url"),
    field("badge", { hasEnum: true }),
  ],
};

export const entry = (o: Partial<NormalizedEntry> & { values: Record<string, unknown> }): NormalizedEntry => ({
  uid: "e1", contentTypeUid: "page", title: "Entry", locale: "en-us", version: 1, publicationKnown: false, ...o,
});

export function input(over: Partial<AnalysisInput> = {}): AnalysisInput {
  return {
    stackId: "s", branch: "main", masterLocale: "en-us",
    locales: [
      { code: "en-us", name: "English", fallbackLocale: null },
      { code: "fr-fr", name: "French", fallbackLocale: "en-us" },
    ],
    contentTypes: [CT],
    sourceEntries: [entry({ values: { title: "Hello there my friend", subtitle: "Second line of copy here", sku_code: "A-1", url: "/x", badge: "new" } })],
    presence: new Map([["page/e1", new Map([["fr-fr", true]])]]),
    targets: new Map(),
    baselines: new Map(),
    ...over,
  };
}

export { fingerprint };
