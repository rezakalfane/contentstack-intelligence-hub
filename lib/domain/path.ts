type Obj = Record<string, unknown>;

interface Located {
  holder: Obj | unknown[];
  key: string | number;
}

/** Resolve a stable fieldPath to the container + key that holds its value. */
function locate(root: Obj, path: string): Located | null {
  const tokens = [...path.matchAll(/([^.[\]]+)(?:\[(?:uid=)?([^\]]+)\])?/g)].map((m) => ({ name: m[1] as string, sel: m[2], isUid: m[0].includes("[uid=") }));
  let cur: unknown = root;
  for (let i = 0; i < tokens.length; i++) {
    const { name, sel, isUid } = tokens[i] as (typeof tokens)[number];
    const last = i === tokens.length - 1;
    if (typeof cur !== "object" || cur === null) return null;
    const holder = cur as Obj;
    if (sel === undefined) {
      if (last) return { holder, key: name };
      cur = holder[name];
      continue;
    }
    const arr = holder[name];
    if (!Array.isArray(arr)) return null;
    if (isUid) {
      const item =
        arr.find((it) => ((it as Obj)?._metadata as Obj | undefined)?.uid === sel) ??
        arr.find((it) => Object.values((it ?? {}) as Obj).some((v) => typeof v === "object" && v !== null && ((v as Obj)._metadata as Obj | undefined)?.uid === sel));
      if (!item) return null;
      cur = item;
    } else {
      const idx = Number(sel);
      if (last) return { holder: arr, key: idx };
      cur = arr[idx];
    }
  }
  return null;
}

/** Set an existing text leaf. Returns false if the path cannot be resolved to a string. */
export function setTextAtPath(root: Obj, path: string, text: string): boolean {
  const loc = locate(root, path);
  if (!loc) return false;
  const h = loc.holder as Record<string | number, unknown>;
  if (typeof h[loc.key] !== "string") return false;
  h[loc.key] = text;
  return true;
}

export function getTextAtPath(root: Obj, path: string): string | undefined {
  const loc = locate(root, path);
  const v = loc ? (loc.holder as Record<string | number, unknown>)[loc.key] : undefined;
  return typeof v === "string" ? v : undefined;
}

/**
 * Restore a text leaf. For items of a multi-value text field (`field[i]`) the CMS drops blank
 * entries, so the array compacts; in that case the item is re-inserted at its original index.
 */
export function restoreTextAtPath(root: Obj, path: string, text: string): boolean {
  const m = /^(.*)\[(\d+)\]$/.exec(path);
  // A blank (or non-array) leaf is set in place; an array item that is not blank means the array compacted.
  if (!m || getTextAtPath(root, path) === "") return setTextAtPath(root, path, text);
  const loc = locate(root, `${m[1]}[0]`); // container of the array, via its first element address
  if (!loc || !Array.isArray(loc.holder)) return false;
  loc.holder.splice(Number(m[2]), 0, text);
  return true;
}

/** The CMA rejects full asset objects on update ("is not a valid upload"); it wants the asset uid. */
function assetsToUid(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(assetsToUid);
  if (typeof value === "object" && value !== null) {
    const o = value as Record<string, unknown>;
    if (typeof o.uid === "string" && typeof o.url === "string" && typeof o.filename === "string") return o.uid;
    return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, assetsToUid(v)]));
  }
  return value;
}

/**
 * Minimal update payload: only the top-level fields that contain a touched path (groups/blocks are
 * replaced wholesale by the CMA, so those are sent in full), with asset objects reduced to uids.
 */
export function minimalUpdateBody(values: Record<string, unknown>, touchedPaths: string[]): Record<string, unknown> {
  const keys = new Set(touchedPaths.map((p) => p.split(/[.[]/)[0] as string));
  return Object.fromEntries([...keys].filter((k) => k in values).map((k) => [k, assetsToUid(values[k])]));
}
