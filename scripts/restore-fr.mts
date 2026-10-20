// Put back exactly the fields that degrade-fr blanked, using the manifest. Drafts only, never publishes.
// A field is restored only if it is still empty (i.e. nobody edited it since); use --force to override.
//   npm run cs:restore -- <backupDir>            (preview)
//   npm run cs:restore -- <backupDir> --apply
import fs from "node:fs";
import path from "node:path";
import { getTextAtPath, minimalUpdateBody, restoreTextAtPath } from "../lib/domain/path.ts";
import { arg, client, flag, stripSystem, TARGET } from "./_cs.mts";

const dir = arg(0);
if (!dir) throw new Error("Usage: cs:restore -- <backupDir> [--apply] [--force]");
const manifest = JSON.parse(fs.readFileSync(path.join(dir, "degrade-manifest.json"), "utf8")) as {
  entries: { contentType: string; uid: string; picks: { path: string; original: string }[] }[];
};
const apply = flag("apply"), force = flag("force");

let restored = 0, skipped = 0, failed = 0;
for (const m of manifest.entries) {
  const url = `/content_types/${m.contentType}/entries/${m.uid}`;
  const { entry } = await client.get<{ entry: Record<string, unknown> }>(url, { locale: TARGET });
  const body = structuredClone(stripSystem(entry));
  const todo: typeof m.picks = [];
  // Ascending order so re-inserting compacted array items rebuilds the original indexes.
  for (const k of [...m.picks].sort((x, y) => x.path.localeCompare(y.path, undefined, { numeric: true }))) {
    const current = getTextAtPath(body, k.path);
    const isArrayItem = /\[\d+\]$/.test(k.path);
    // Skip if already restored, or (unless --force) if someone has put different text there since.
    if (current === k.original) { skipped++; console.log(`  skip ${m.uid} ${k.path}: already restored`); continue; }
    if (!force && !isArrayItem && current !== "") { skipped++; console.log(`  skip ${m.uid} ${k.path}: not empty any more (edited since?) — use --force to overwrite`); continue; }
    if (!restoreTextAtPath(body, k.path, k.original)) { failed++; console.log(`  ! ${m.uid} ${k.path}: path no longer resolves`); continue; }
    todo.push(k);
  }
  if (!todo.length) continue;
  if (!apply) { console.log(`would restore ${todo.length} field(s) in ${m.contentType}/${m.uid}`); restored += todo.length; continue; }
  try {
    await client.put(url, { entry: minimalUpdateBody(body, todo.map((k) => k.path)) }, { locale: TARGET });
    const { entry: after } = await client.get<{ entry: Record<string, unknown> }>(url, { locale: TARGET });
    const ok = todo.every((k) => JSON.stringify(after).includes(JSON.stringify(k.original).slice(1, -1)));
    console.log(`${ok ? "restored" : "UNVERIFIED"} ${todo.length} field(s) in ${m.contentType}/${m.uid}`);
    restored += todo.length;
    if (!ok) failed++;
  } catch (err) { failed++; console.log(`  ! ${m.contentType}/${m.uid}: ${(err as Error).message}`); }
}
console.log(`\n${apply ? "Restored" : "Would restore"} ${restored} field(s); skipped ${skipped}; failed ${failed}.${apply ? "" : " DRY RUN — re-run with --apply."}`);
