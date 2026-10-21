import { shortId } from "./fingerprint";
import { isRichText, richTextToPlain } from "./richtext";
import type {
  FieldUsageRow, NormalizedContentType, NormalizedEntry, ReferenceGraph, SchemaField, Severity,
} from "./types";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

export const GOV = {
  minEntriesForUsage: 5,
  rareFillRatio: 0.1,
  rareMinEntries: 10,
  deepNesting: { medium: 4, high: 5 },
  wide: { low: 25, medium: 40 },
  manyBlockTypes: 12,
  broadReferenceTargets: 5,
  sharedFieldsMin: 3,
  complexityBands: { medium: 25, high: 60 },
  riskBands: { medium: 30, high: 60 },
};
export const PENALTY: Record<Severity, number> = { critical: 20, high: 15, medium: 8, low: 3 };

export const SCHEMA_RULES: Record<string, { title: string; logic: string; severity: string }> = {
  "SCH-001": { title: "Unused or rarely used field", severity: "medium / low", logic: `Never populated across ≥${GOV.minEntriesForUsage} entries (medium), or populated in under ${GOV.rareFillRatio * 100}% of ≥${GOV.rareMinEntries} entries (low)` },
  "SCH-002": { title: "Repeated structure", severity: "medium", logic: `The same group of ≥3 fields appears in several places, or ≥${GOV.sharedFieldsMin} identical fields are repeated across content types: a Global Field candidate` },
  "SCH-003": { title: "Deep nesting", severity: "medium / high", logic: `Groups, global fields and block types nested ${GOV.deepNesting.medium}+ levels (medium) or ${GOV.deepNesting.high}+ (high): hard to edit and heavy to deliver` },
  "SCH-004": { title: "Wide content type", severity: "low / medium", logic: `More than ${GOV.wide.low} fields (low) or ${GOV.wide.medium} (medium)` },
  "SCH-005": { title: "Block type bloat", severity: "medium / low", logic: `More than ${GOV.manyBlockTypes} block types, block types with identical fields, or a block type never used` },
  "SCH-006": { title: "Near-duplicate field names", severity: "low", logic: "Two fields of the same type whose names differ only by a seo_/meta_/og_ prefix, so editors must guess which to fill (title/meta_title is exempt)" },
  "SCH-007": { title: "Generic field name", severity: "low", logic: "Field uid such as field1, new_field, untitled, test: unclear intent and brittle to integrate" },
  "SCH-008": { title: "Empty content type", severity: "low", logic: "No entries in the scanned branch: candidate for retirement (or a template not yet used)" },
  "SCH-009": { title: "Broken or broad reference", severity: "high / low", logic: `Reference field points at a content type that does not exist (high), or at more than ${GOV.broadReferenceTargets} types (low)` },
  "SCH-010": { title: "Localization setting looks wrong", severity: "medium / low", logic: "Translatable-looking text (headline, description, label…) is non-localizable (medium), or an identifier (sku, id, slug, code…) is localizable (low). `title` is exempt (often an internal name)" },
  "SCH-011": { title: "Fragile core type", severity: "medium", logic: "High complexity combined with high change risk: changes here are expensive and need a migration plan" },
};

// ---------- Schema walking ----------

export interface FlatField {
  path: string;
  field: SchemaField;
  /** 1 = top-level. Groups, global fields and block types each add a level. */
  depth: number;
  kind: "leaf" | "group" | "global_field" | "blocks" | "block_type";
  parent?: string;
}

export function flattenSchema(schema: SchemaField[], prefix = "", depth = 1, parent?: string): FlatField[] {
  return schema.flatMap((f) => {
    const path = prefix ? `${prefix}.${f.uid}` : f.uid;
    const self: FlatField = { path, field: f, depth, parent, kind: f.dataType === "group" ? "group" : f.dataType === "global_field" ? "global_field" : f.dataType === "blocks" ? "blocks" : "leaf" };
    if (f.schema && (f.dataType === "group" || f.dataType === "global_field")) return [self, ...flattenSchema(f.schema, path, depth + 1, path)];
    if (f.blocks) {
      return [self, ...f.blocks.flatMap((b) => {
        const bp = `${path}.${b.uid}`;
        return [{ path: bp, field: { ...f, uid: b.uid, displayName: b.displayName, dataType: "group" as const, schema: b.schema, blocks: undefined }, depth: depth + 1, kind: "block_type" as const, parent: path } satisfies FlatField, ...flattenSchema(b.schema, bp, depth + 2, bp)];
      })];
    }
    return [self];
  });
}

// ---------- Field usage (computed during the scan from real entries) ----------

function filled(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (typeof v === "boolean") return v; // an untouched boolean is false
  if (Array.isArray(v)) return v.some(filled);
  if (isRichText(v)) return richTextToPlain(v).trim() !== "";
  if (isObj(v)) return Object.entries(v).some(([k, x]) => k !== "_metadata" && k !== "uid" && filled(x)) || (typeof v.uid === "string" && typeof v.url === "string"); // assets/references
  return true;
}

/** Schema paths that hold a value in this entry. Group/block instances collapse to their schema path. */
export function presentPaths(schema: SchemaField[], values: Obj, prefix = "", out = new Set<string>()): Set<string> {
  for (const f of schema) {
    const v = values?.[f.uid];
    const path = prefix ? `${prefix}.${f.uid}` : f.uid;
    if (v === undefined || v === null) continue;
    if (f.dataType === "group" || f.dataType === "global_field") {
      const items = ([] as unknown[]).filter.call(([] as unknown[]).concat(v), isObj) as Obj[];
      if (items.length) {
        let any = false;
        for (const it of items) { const before = out.size; presentPaths(f.schema ?? [], it, path, out); if (out.size > before) any = true; }
        if (any) out.add(path);
      }
    } else if (f.dataType === "blocks") {
      for (const item of ([] as unknown[]).concat(v)) {
        if (!isObj(item)) continue;
        for (const b of f.blocks ?? []) {
          const inner = item[b.uid];
          if (isObj(inner)) { out.add(path); out.add(`${path}.${b.uid}`); presentPaths(b.schema, inner, `${path}.${b.uid}`, out); }
        }
      }
    } else if (filled(v)) out.add(path);
  }
  return out;
}

export function computeFieldUsage(contentTypes: NormalizedContentType[], entries: NormalizedEntry[]): FieldUsageRow[] {
  const rows: FieldUsageRow[] = [];
  for (const ct of contentTypes) {
    const mine = entries.filter((e) => e.contentTypeUid === ct.uid);
    const counts = new Map<string, number>();
    for (const e of mine) for (const p of presentPaths(ct.schema, e.values)) counts.set(p, (counts.get(p) ?? 0) + 1);
    for (const f of flattenSchema(ct.schema)) rows.push({ contentTypeUid: ct.uid, path: f.path, filled: counts.get(f.path) ?? 0, total: mine.length });
  }
  return rows;
}

// ---------- Analysis ----------

export interface SchemaFinding {
  id: string;
  ruleId: string;
  severity: Severity;
  contentTypeUid: string;
  contentTypeTitle: string;
  fieldPath?: string;
  message: string;
  evidence: string[];
  recommendation: string;
  penalty: number;
}

export interface TypeReport {
  uid: string;
  title: string;
  entries: number;
  fields: number; // leaf fields
  maxDepth: number;
  groups: number;
  blockTypes: number;
  references: number;
  mandatory: number;
  complexity: number;
  complexityBand: "low" | "medium" | "high";
  inbound: { entries: number; types: number };
  risk: { score: number; band: "low" | "medium" | "high"; rationale: string[] };
  findings: number;
  score: number;
  fieldRows: (FlatField & { filled: number; total: number })[];
}

export interface SimilarityPair { a: string; b: string; shared: string[]; score: number }

export interface SchemaAnalysis {
  types: TypeReport[];
  findings: SchemaFinding[];
  similarity: SimilarityPair[];
  score: number | null;
  totals: { types: number; fields: number; entries: number };
}

const band = (v: number, b: { medium: number; high: number }): "low" | "medium" | "high" => (v >= b.high ? "high" : v >= b.medium ? "medium" : "low");
const sig = (f: SchemaField[]) => f.map((x) => `${x.uid}:${x.dataType}`).sort().join("|");
const tokens = (uid: string) => uid.split("_").filter((t) => !["seo", "meta", "og"].includes(t)).join("_");
const TRANSLATABLE = /^(headline|heading|description|summary|tagline|label|cta(_.*)?|message|subtitle|intro|body|copy|caption|standfirst|alt(_.*)?|.*_alt)$/i;
const IDENTIFIER = /(^|_)(sku|id|uid|slug|code|gtin|ean|isbn|email|phone|href|url)$/i;
const GENERIC = /^(field|new_field|untitled|test|tmp|temp|foo|bar|misc)\d*$|^(field|text|data|value)\d+$/i;

export function analyzeSchemas(input: {
  schemas: NormalizedContentType[];
  usage: FieldUsageRow[];
  graph?: ReferenceGraph;
  localeCount: number;
}): SchemaAnalysis {
  const { schemas, usage } = input;
  const usageBy = new Map(usage.map((u) => [`${u.contentTypeUid}|${u.path}`, u]));
  const known = new Set(schemas.map((s) => s.uid));
  const findings: SchemaFinding[] = [];
  const add = (ct: NormalizedContentType, o: Omit<SchemaFinding, "id" | "contentTypeUid" | "contentTypeTitle" | "penalty">) => {
    findings.push({ ...o, id: shortId("g", `${o.ruleId}|${ct.uid}|${o.fieldPath ?? ""}|${o.message}`), contentTypeUid: ct.uid, contentTypeTitle: ct.title, penalty: PENALTY[o.severity] });
  };

  // inbound dependencies from the reference graph
  const nodeCt = new Map((input.graph?.nodes ?? []).map((n) => [n.id, n.contentTypeUid]));
  const inbound = new Map<string, { entries: Set<string>; types: Set<string> }>();
  for (const e of input.graph?.edges ?? []) {
    const toCt = nodeCt.get(e.to);
    const fromCt = nodeCt.get(e.from);
    if (!toCt || !fromCt || nodeCt.get(e.from) === undefined) continue;
    if (e.to.startsWith("asset/")) continue;
    const cur = inbound.get(toCt) ?? { entries: new Set(), types: new Set() };
    if (fromCt !== toCt) cur.types.add(fromCt);
    cur.entries.add(e.from);
    inbound.set(toCt, cur);
  }

  const reports: TypeReport[] = [];
  const structures = new Map<string, { ct: NormalizedContentType; path: string }[]>();
  const leafSets = new Map<string, Set<string>>();

  for (const ct of schemas) {
    const flat = flattenSchema(ct.schema);
    const leaves = flat.filter((f) => f.kind === "leaf");
    const entries = usage.find((u) => u.contentTypeUid === ct.uid)?.total ?? 0;
    const rows = flat.map((f) => ({ ...f, filled: usageBy.get(`${ct.uid}|${f.path}`)?.filled ?? 0, total: entries }));

    // SCH-001 unused / rare. A flagged container suppresses its children: one decision, one finding.
    const skip = new Set<string>();
    for (const r of rows) {
      if (r.parent && skip.has(r.parent)) { if (r.kind !== "leaf") skip.add(r.path); continue; }
      if (r.kind === "block_type") { if (entries >= GOV.minEntriesForUsage && r.filled === 0) skip.add(r.path); continue; } // reported by SCH-005
      const container = r.kind !== "leaf";
      if (entries >= GOV.minEntriesForUsage && r.filled === 0 && r.path !== "title") {
        skip.add(r.path);
        add(ct, { ruleId: "SCH-001", severity: "medium", fieldPath: r.path, message: `“${r.path}” is never filled in`, evidence: [`Empty in all ${entries} entries of ${ct.title}${r.field.mandatory ? ", although it is marked mandatory" : ""}.${container ? " Everything inside it is unused too." : ""}`], recommendation: r.field.mandatory ? "A mandatory field that is always empty indicates entries predate the rule or validation is bypassed. Fix the data or drop the requirement." : "Check whether anything still reads it, then remove it to simplify editing and the API payload." });
      } else if (entries >= GOV.rareMinEntries && r.filled > 0 && r.filled / entries < GOV.rareFillRatio) {
        if (container) skip.add(r.path);
        add(ct, { ruleId: "SCH-001", severity: "low", fieldPath: r.path, message: `“${r.path}” is rarely used (${r.filled}/${entries})`, evidence: [`Filled in ${Math.round((100 * r.filled) / entries)}% of entries.${container ? " Its inner fields are at most as common." : ""}`], recommendation: "Consider moving it into a separate optional block or removing it if it has outlived its purpose." });
      }
    }
    const unusedContainers = skip; // used below to avoid double-reporting unused block types inside unused containers

    // SCH-003 / SCH-004
    const maxDepth = Math.max(1, ...flat.map((f) => (f.kind === "block_type" ? f.depth : f.depth)));
    if (maxDepth >= GOV.deepNesting.medium) add(ct, { ruleId: "SCH-003", severity: maxDepth >= GOV.deepNesting.high ? "high" : "medium", message: `Nested ${maxDepth} levels deep`, evidence: [`Deepest path: ${flat.filter((f) => f.depth === maxDepth).map((f) => f.path)[0]}`], recommendation: "Flatten where possible, or split deeply nested parts into their own referenced content type." });
    if (leaves.length > GOV.wide.low) add(ct, { ruleId: "SCH-004", severity: leaves.length > GOV.wide.medium ? "medium" : "low", message: `${leaves.length} fields in one content type`, evidence: [`Editors scroll through ${leaves.length} fields; the delivery payload grows with every one.`], recommendation: "Group related fields, extract reusable parts into Global Fields, or split the type." });

    // SCH-005 block bloat / duplicate / unused block types
    for (const f of flat.filter((x) => x.kind === "blocks")) {
      const types = f.field.blocks ?? [];
      if (types.length > GOV.manyBlockTypes) add(ct, { ruleId: "SCH-005", severity: "medium", fieldPath: f.path, message: `“${f.path}” has ${types.length} block types`, evidence: ["A long block palette is hard for editors to choose from."], recommendation: "Merge similar blocks and use variants/options instead of separate block types." });
      const bySig = new Map<string, string[]>();
      for (const b of types) bySig.set(sig(b.schema), [...(bySig.get(sig(b.schema)) ?? []), b.uid]);
      for (const [, uids] of bySig) if (uids.length > 1) add(ct, { ruleId: "SCH-005", severity: "medium", fieldPath: f.path, message: `Block types ${uids.join(", ")} have identical fields`, evidence: ["Identical schemas duplicate maintenance and confuse editors."], recommendation: "Keep one block type and distinguish variants with an enum field." });
      if (entries >= GOV.minEntriesForUsage) for (const b of types) {
        const r = usageBy.get(`${ct.uid}|${f.path}.${b.uid}`);
        if (r && r.filled === 0 && !unusedContainers.has(f.path)) add(ct, { ruleId: "SCH-005", severity: "low", fieldPath: `${f.path}.${b.uid}`, message: `Block type “${b.uid}” is never used`, evidence: [`No ${ct.title} entry contains a “${b.uid}” block.`], recommendation: "Remove the unused block type to shorten the editor's choices." });
      }
    }

    // SCH-006 near-duplicate names, SCH-007 generic names (within the same container)
    const byContainer = new Map<string, FlatField[]>();
    for (const f of flat.filter((x) => x.kind !== "block_type")) byContainer.set(f.parent ?? "", [...(byContainer.get(f.parent ?? "") ?? []), f]);
    for (const [, group] of byContainer) {
      const seen = new Map<string, FlatField>();
      for (const f of group) {
        const key = `${tokens(f.field.uid)}:${f.field.dataType}`;
        const prev = seen.get(key);
        // title vs meta_title is a normal pairing (entry title vs SEO title), not redundancy
        if (prev && prev.field.uid !== f.field.uid && prev.field.uid !== "title" && f.field.uid !== "title") add(ct, { ruleId: "SCH-006", severity: "low", fieldPath: f.path, message: `“${prev.field.uid}” and “${f.field.uid}” look redundant`, evidence: ["Same type, names differ only by a seo_/meta_/og_ prefix."], recommendation: "Keep one and migrate the other, so editors know where to write." });
        else seen.set(key, f);
      }
      for (const f of group) if (GENERIC.test(f.field.uid)) add(ct, { ruleId: "SCH-007", severity: "low", fieldPath: f.path, message: `Generic field name “${f.field.uid}”`, evidence: ["The name does not say what the field is for."], recommendation: "Rename (via a new field and migration) to something descriptive." });
    }

    // SCH-009 broken / broad references
    for (const f of flat.filter((x) => x.field.dataType === "reference")) {
      const targets = f.field.referenceTo ?? [];
      const missing = targets.filter((t) => !known.has(t));
      if (missing.length) add(ct, { ruleId: "SCH-009", severity: "high", fieldPath: f.path, message: `“${f.path}” references missing content type ${missing.join(", ")}`, evidence: ["Editors cannot pick entries, and delivery returns unresolved references."], recommendation: "Point the field at an existing content type or remove it." });
      else if (targets.length > GOV.broadReferenceTargets) add(ct, { ruleId: "SCH-009", severity: "low", fieldPath: f.path, message: `“${f.path}” can reference ${targets.length} content types`, evidence: ["Very broad references make rendering and impact analysis unpredictable."], recommendation: "Narrow the allowed content types." });
    }

    // SCH-010 localization hygiene (only meaningful with several locales)
    if (input.localeCount > 1) {
      for (const f of leaves) {
        const textual = f.field.dataType === "text" || f.field.dataType === "json";
        if (!textual || f.field.hasEnum) continue;
        if (f.field.nonLocalizable && f.field.uid !== "title" && TRANSLATABLE.test(f.field.uid)) add(ct, { ruleId: "SCH-010", severity: "medium", fieldPath: f.path, message: `“${f.path}” looks translatable but is non-localizable`, evidence: [`With ${input.localeCount} locales, every market will show the master-locale text.`], recommendation: "Make the field localizable, or confirm it is intentionally identical in every market." });
        if (!f.field.nonLocalizable && f.field.dataType === "text" && IDENTIFIER.test(f.field.uid)) add(ct, { ruleId: "SCH-010", severity: "low", fieldPath: f.path, message: `“${f.path}” looks like an identifier but is localizable`, evidence: ["Identifiers are usually the same in every market; localizing them creates drift and translation work."], recommendation: "Make it non-localizable unless markets genuinely need different values (e.g. translated URLs)." });
      }
    }

    // SCH-008 empty content type
    if (entries === 0) add(ct, { ruleId: "SCH-008", severity: "low", message: "No entries", evidence: ["The scanned branch has no entries of this type."], recommendation: "Retire the content type if it is unused, or document it as a template." });

    // collect structures for repetition analysis
    for (const f of flat.filter((x) => x.kind === "group" && (x.field.schema?.length ?? 0) >= 3)) structures.set(sig(f.field.schema ?? []), [...(structures.get(sig(f.field.schema ?? [])) ?? []), { ct, path: f.path }]);
    leafSets.set(ct.uid, new Set(flat.filter((f) => f.kind === "leaf" && !flat.some((p) => p.kind === "global_field" && f.path.startsWith(`${p.path}.`)) && f.field.uid !== "title").map((f) => `${f.field.uid}:${f.field.dataType}`)));

    const groups = flat.filter((f) => f.kind === "group" || f.kind === "global_field").length;
    const blockTypes = flat.filter((f) => f.kind === "block_type").length;
    const refs = flat.filter((f) => f.field.dataType === "reference").length;
    const complexity = leaves.length + 4 * maxDepth + 3 * blockTypes + 2 * groups + refs;
    const inc = inbound.get(ct.uid);
    const inboundEntries = inc?.entries.size ?? 0;
    const inboundTypes = inc?.types.size ?? 0;
    const riskScore = Math.min(100, Math.round(entries * 1.5 + inboundEntries * 2 + inboundTypes * 8));
    reports.push({
      uid: ct.uid, title: ct.title, entries, fields: leaves.length, maxDepth, groups, blockTypes, references: refs,
      mandatory: leaves.filter((l) => l.field.mandatory).length,
      complexity, complexityBand: band(complexity, GOV.complexityBands),
      inbound: { entries: inboundEntries, types: inboundTypes },
      risk: {
        score: riskScore, band: band(riskScore, GOV.riskBands),
        rationale: [`${entries} entr${entries === 1 ? "y" : "ies"} would carry any breaking change`, `${inboundEntries} entr${inboundEntries === 1 ? "y" : "ies"} in ${inboundTypes} other type${inboundTypes === 1 ? "" : "s"} reference it`, ...(input.localeCount > 1 ? [`Each change must be checked in ${input.localeCount} locales`] : [])],
      },
      findings: 0, score: 100, fieldRows: rows,
    });
  }

  // SCH-011 fragile core
  for (const r of reports) if (r.complexityBand === "high" && r.risk.band === "high") {
    const ct = schemas.find((s) => s.uid === r.uid)!;
    add(ct, { ruleId: "SCH-011", severity: "medium", message: `${r.title} is complex (${r.complexity}) and high-risk to change (${r.risk.score})`, evidence: r.risk.rationale, recommendation: "Plan changes as migrations, test against a branch, and avoid renaming or retyping fields in place." });
  }

  // SCH-002 repeated group structures and repeated top-level field sets
  for (const [, where] of structures) {
    const places = where.filter((w, i) => where.findIndex((x) => x.ct.uid === w.ct.uid && x.path === w.path) === i);
    if (places.length > 1) add(places[0]!.ct, { ruleId: "SCH-002", severity: "medium", fieldPath: places[0]!.path, message: `The same ${places.length}-place group structure repeats`, evidence: places.map((p) => `${p.ct.title} → ${p.path}`), recommendation: "Extract it into a Global Field and reuse it, so changes are made once." });
  }
  const similarity: SimilarityPair[] = [];
  const uids = [...leafSets.keys()];
  for (let i = 0; i < uids.length; i++) for (let j = i + 1; j < uids.length; j++) {
    const A = leafSets.get(uids[i]!)!, B = leafSets.get(uids[j]!)!;
    const shared = [...A].filter((x) => B.has(x));
    const union = new Set([...A, ...B]).size;
    similarity.push({ a: uids[i]!, b: uids[j]!, shared, score: union ? shared.length / union : 0 });
  }
  for (const s of [...similarity].filter((p) => p.shared.length >= GOV.sharedFieldsMin).sort((x, y) => y.shared.length - x.shared.length).slice(0, 8)) {
    const ct = schemas.find((c) => c.uid === s.a)!;
    const other = schemas.find((c) => c.uid === s.b)!;
    add(ct, { ruleId: "SCH-002", severity: "medium", message: `${ct.title} and ${other.title} share ${s.shared.length} identical fields`, evidence: [s.shared.map((x) => x.split(":")[0]).join(", "), `${Math.round(s.score * 100)}% overlap`], recommendation: "Extract the shared fields into a Global Field (or merge the types if they are variants of one thing)." });
  }

  // scoring
  for (const r of reports) {
    const mine = findings.filter((f) => f.contentTypeUid === r.uid);
    r.findings = mine.length;
    r.score = Math.max(0, 100 - mine.reduce((n, f) => n + f.penalty, 0));
  }
  const order: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  findings.sort((a, b) => order[a.severity] - order[b.severity] || a.contentTypeTitle.localeCompare(b.contentTypeTitle));
  const scored = reports.filter((r) => r.fields > 0);
  return {
    types: reports.sort((a, b) => b.complexity - a.complexity),
    findings,
    similarity,
    score: scored.length ? Math.round(scored.reduce((n, r) => n + r.score, 0) / scored.length) : null,
    totals: { types: reports.length, fields: reports.reduce((n, r) => n + r.fields, 0), entries: reports.reduce((n, r) => n + r.entries, 0) },
  };
}
