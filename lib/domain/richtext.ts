// Contentstack JSON RTE helpers. The model never sees or produces the JSON tree:
// we extract text leaves with stable paths, translate the leaves, then rebuild.

type Node = { text?: unknown; children?: unknown; [k: string]: unknown };

export interface RichLeaf {
  /** Path of child indexes from the root, e.g. "children.0.children.1" */
  path: string;
  text: string;
}

function isNode(v: unknown): v is Node {
  return typeof v === "object" && v !== null;
}

export function isRichText(value: unknown): value is Node {
  return isNode(value) && (value as Node).type === "doc" && Array.isArray((value as Node).children);
}

export function richTextLeaves(root: unknown): RichLeaf[] {
  const out: RichLeaf[] = [];
  const walk = (node: unknown, path: string) => {
    if (!isNode(node)) return;
    if (typeof node.text === "string") out.push({ path, text: node.text });
    if (Array.isArray(node.children)) {
      node.children.forEach((c, i) => walk(c, path ? `${path}.children.${i}` : `children.${i}`));
    }
  };
  walk(root, "");
  return out;
}

/** Plain text: one line per top-level block. */
export function richTextToPlain(root: unknown): string {
  if (!isRichText(root)) return "";
  const lines: string[] = [];
  for (const block of root.children as unknown[]) {
    const leaves = richTextLeaves(block);
    const line = leaves.map((l) => l.text).join("");
    if (line.trim()) lines.push(line);
  }
  return lines.join("\n");
}

export function richTextBlockCount(root: unknown): number {
  return isRichText(root) ? (root.children as unknown[]).length : 0;
}

/**
 * Rebuild a copy of `root` with leaf texts replaced. Throws if the leaf set differs
 * (the tree shape is immutable; only `text` values change).
 */
export function replaceRichTextLeaves(root: unknown, replacements: Map<string, string>): unknown {
  const clone = structuredClone(root) as Node;
  const original = richTextLeaves(clone);
  if (original.length !== replacements.size) {
    throw new Error(`Rich text leaf count mismatch: expected ${original.length}, got ${replacements.size}`);
  }
  for (const leaf of original) {
    const next = replacements.get(leaf.path);
    if (next === undefined) throw new Error(`Missing replacement for leaf ${leaf.path}`);
    let node: unknown = clone;
    if (leaf.path) {
      for (const part of leaf.path.split(".")) {
        node = (node as Record<string, unknown>)[part];
      }
    }
    (node as Node).text = next;
  }
  return clone;
}
