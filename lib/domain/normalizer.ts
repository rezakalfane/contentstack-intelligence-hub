import type { FieldDataType, NormalizedContentType, SchemaField } from "./types";
import { isRichText, richTextToPlain } from "./richtext";

// ---------- Raw CMA schema -> SchemaField ----------

interface RawField {
  uid: string;
  display_name?: string;
  data_type: string;
  mandatory?: boolean;
  multiple?: boolean;
  non_localizable?: boolean;
  enum?: unknown;
  reference_to?: string | string[];
  field_metadata?: { allow_json_rte?: boolean };
  schema?: RawField[];
  blocks?: { uid: string; title?: string; schema: RawField[] }[];
}

export interface RawContentType {
  uid: string;
  title?: string;
  schema: RawField[];
}

const KNOWN: Record<string, FieldDataType> = {
  text: "text",
  json: "json",
  group: "group",
  global_field: "global_field",
  blocks: "blocks",
  reference: "reference",
  file: "file",
  link: "link",
  number: "number",
  boolean: "boolean",
  isodate: "isodate",
};

export function normalizeSchema(raw: RawField[], globals: Map<string, RawField[]>, depth = 0): SchemaField[] {
  if (depth > 8) return []; // guard against pathological nesting
  return raw.map((f) => {
    let dataType: FieldDataType = KNOWN[f.data_type] ?? "other";
    // Only JSON RTE is translatable; plain JSON fields are opaque.
    if (dataType === "json" && !f.field_metadata?.allow_json_rte) dataType = "other";
    const field: SchemaField = {
      uid: f.uid,
      displayName: f.display_name ?? f.uid,
      dataType,
      mandatory: Boolean(f.mandatory),
      multiple: Boolean(f.multiple),
      nonLocalizable: Boolean(f.non_localizable),
      hasEnum: Boolean(f.enum),
    };
    if (dataType === "reference") field.referenceTo = ([] as string[]).concat(f.reference_to ?? []);
    if (dataType === "group") field.schema = normalizeSchema(f.schema ?? [], globals, depth + 1);
    if (dataType === "global_field") {
      const nested = f.schema ?? globals.get(typeof f.reference_to === "string" ? f.reference_to : "") ?? [];
      field.schema = normalizeSchema(nested, globals, depth + 1);
    }
    if (dataType === "blocks") {
      field.blocks = (f.blocks ?? []).map((b) => ({
        uid: b.uid,
        displayName: b.title ?? b.uid,
        schema: normalizeSchema(b.schema, globals, depth + 1),
      }));
    }
    return field;
  });
}

export function normalizeContentType(raw: RawContentType, globals: Map<string, RawField[]>): NormalizedContentType {
  return { uid: raw.uid, title: raw.title ?? raw.uid, schema: normalizeSchema(raw.schema, globals) };
}

// ---------- Policy: text fields that are identifiers, not copy ----------

/** Disclosed in the UI as a policy exclusion. */
export const EXCLUDED_TEXT_FIELD = /^(url|slug|href|src|email|.*_url|.*_sku|.*_skus|.*_email|.*phone.*)$/i;
export const EXCLUSION_POLICY_NOTE =
  "Fields excluded by policy (identifiers, not copy): url, slug, href, src, *_sku, *_skus, *_url, *_email, *phone*, enum fields, non-localizable fields.";

// ---------- Entry values -> translatable leaves ----------

export interface Leaf {
  path: string;
  /** Same leaf addressed by array position instead of instance id (used when locales carry different instance ids). */
  ppath: string;
  label: string;
  kind: "text" | "richtext";
  mandatory: boolean;
  nonLocalizable: boolean;
  text: string;
}

function instanceId(item: unknown, index: number): string {
  const meta = (item as { _metadata?: { uid?: unknown } } | null)?._metadata;
  return typeof meta?.uid === "string" ? `[uid=${meta.uid}]` : `[${index}]`;
}

function asArray(value: unknown, multiple: boolean): unknown[] {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value;
  return multiple ? [value] : [value];
}

/**
 * Walk a schema against entry values and emit every translatable leaf (including empty ones).
 * Paths use `_metadata.uid` for repeated instances so a reorder does not change identity.
 */
export function extractLeaves(schema: SchemaField[], values: Record<string, unknown>): Leaf[] {
  const out: Leaf[] = [];
  const visit = (
    fields: SchemaField[],
    data: Record<string, unknown>,
    prefix: string,
    pprefix: string,
    labelPrefix: string,
    inheritedNonLocalizable: boolean,
  ) => {
    for (const f of fields) {
      const value = data?.[f.uid];
      const path = prefix ? `${prefix}.${f.uid}` : f.uid;
      const ppath = pprefix ? `${pprefix}.${f.uid}` : f.uid;
      const label = labelPrefix ? `${labelPrefix} › ${f.displayName}` : f.displayName;
      const nonLocalizable = inheritedNonLocalizable || f.nonLocalizable;

      switch (f.dataType) {
        case "text": {
          if (f.hasEnum || EXCLUDED_TEXT_FIELD.test(f.uid)) break;
          if (f.multiple) {
            const items = Array.isArray(value) ? value : value ? [value] : [];
            items.forEach((item, i) =>
              out.push({
                path: `${path}[${i}]`,
                ppath: `${ppath}[${i}]`,
                label: `${label} #${i + 1}`,
                kind: "text",
                mandatory: f.mandatory,
                nonLocalizable,
                text: typeof item === "string" ? item : "",
              }),
            );
          } else {
            out.push({
              path,
              ppath,
              label,
              kind: "text",
              mandatory: f.mandatory,
              nonLocalizable,
              text: typeof value === "string" ? value : "",
            });
          }
          break;
        }
        case "json": {
          out.push({
            path,
            ppath,
            label,
            kind: "richtext",
            mandatory: f.mandatory,
            nonLocalizable,
            text: isRichText(value) ? richTextToPlain(value) : "",
          });
          break;
        }
        case "group":
        case "global_field": {
          asArray(value, f.multiple).forEach((item, i) => {
            if (typeof item !== "object" || item === null) return;
            const id = f.multiple ? instanceId(item, i) : "";
            const pid = f.multiple ? `[${i}]` : "";
            visit(f.schema ?? [], item as Record<string, unknown>, `${path}${id}`, `${ppath}${pid}`, label, nonLocalizable);
          });
          break;
        }
        case "blocks": {
          asArray(value, true).forEach((item, i) => {
            if (typeof item !== "object" || item === null) return;
            for (const block of f.blocks ?? []) {
              const inner = (item as Record<string, unknown>)[block.uid];
              if (typeof inner !== "object" || inner === null) continue;
              visit(
                block.schema,
                inner as Record<string, unknown>,
                `${path}${instanceId(inner, i)}.${block.uid}`,
                `${ppath}[${i}].${block.uid}`,
                `${label} › ${block.displayName}`,
                nonLocalizable,
              );
            }
          });
          break;
        }
        default:
          break; // references, files, numbers, booleans, dates, links: not translatable text
      }
    }
  };
  visit(schema, values, "", "", "", false);
  return out;
}

export function entryDisplayTitle(values: Record<string, unknown>, fallback: string): string {
  return typeof values.title === "string" && values.title.trim() ? values.title : fallback;
}

/** Index target leaves for matching: by stable path first, then by position (instance ids can differ between locales). */
export function indexLeaves(leaves: Leaf[]) {
  return { byPath: new Map(leaves.map((l) => [l.path, l])), byPos: new Map(leaves.map((l) => [l.ppath, l])) };
}

export function matchLeaf(idx: ReturnType<typeof indexLeaves>, source: Leaf): { leaf?: Leaf; byPosition: boolean } {
  const direct = idx.byPath.get(source.path);
  if (direct) return { leaf: direct, byPosition: false };
  const pos = source.path === source.ppath ? undefined : idx.byPos.get(source.ppath);
  return { leaf: pos, byPosition: Boolean(pos) };
}
