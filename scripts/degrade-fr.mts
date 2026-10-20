// Blank ~10% of French text fields to make gaps visible in the UI. Drafts only, never publishes.
// Dry run by default.   npm run cs:degrade -- <backupDir>            (preview)
//                       npm run cs:degrade -- <backupDir> --apply    (write drafts)
// Writes <backupDir>/degrade-manifest.json, which scripts/restore-fr.mts uses to put every value back.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { extractLeaves, normalizeContentType, type RawContentType } from "../lib/domain/normalizer.ts";
import { minimalUpdateBody, setTextAtPath } from "../lib/domain/path.ts";
import { arg, client, flag, stripSystem, TARGET } from "./_cs.mts";

const RATE = 10; // percent
const dir = arg(0);
if (!dir) throw new Error("Usage: cs:degrade -- <backupDir> [--apply]");
const backup = JSON.parse(fs.readFileSync(path.join(dir, "backup.json"), "utf8"));
const apply = flag("apply");
const manifestPath = path.join(dir, "degrade-manifest.json");


const hash = (s: string) => parseInt(createHash("sha1").update(`degrade|${s}`).digest("hex").slice(0, 8), 16) % 100;
const cts = new Map<string, ReturnType<typeof normalizeContentType>>(backup.contentTypes.map((c: RawContentType) => [c.uid, normalizeContentType(c, new Map())]));

interface Pick { path: string; label: string; original: string; mandatory: boolean }
const plan: { contentType: string; uid: string; version: number; picks: Pick[] }[] = [];
let candidates = 0;
for (const row of backup.entries.filter((e: { locale: string }) => e.locale === TARGET)) {
  const ct = cts.get(row.contentType);
  if (!ct) continue;
  const leaves = extractLeaves(ct.schema, row.entry).filter((l) => l.kind === "text" && !l.nonLocalizable && l.text.trim());
  candidates += leaves.length;
  const picks = leaves.filter((l) => hash(`${row.contentType}/${row.uid}/${l.path}`) < RATE).map((l) => ({ path: l.path, label: l.label, original: l.text, mandatory: l.mandatory }));
  if (picks.length) plan.push({ contentType: row.contentType, uid: row.uid, version: row.entry._version as number, picks });
}
const total = plan.reduce((n, p) => n + p.picks.length, 0);
console.log(`${TARGET}: ${candidates} text fields, ${total} selected (${((100 * total) / candidates).toFixed(1)}%) across ${plan.length} entries`);
const byType: Record<string, number> = {};
for (const p of plan) byType[p.contentType] = (byType[p.contentType] ?? 0) + p.picks.length;
console.log("by content type:", byType, "| mandatory fields:", plan.flatMap((p) => p.picks).filter((x) => x.mandatory).length);
if (!apply) {
  for (const p of plan.slice(0, 8)) console.log(` - ${p.contentType}/${p.uid}: ${p.picks.map((x) => x.path).join(", ")}`);
  console.log("\nDRY RUN — nothing written. Re-run with --apply to write drafts.");
  process.exit(0);
}

const done: unknown[] = [];
const failed: string[] = [];
for (const p of plan) {
  const url = `/content_types/${p.contentType}/entries/${p.uid}`;
  const { entry } = await client.get<{ entry: Record<string, unknown> & { _version: number } }>(url, { locale: TARGET });
  if (entry._version !== p.version) {
    // Resume support: if every picked field is already blank, an earlier run did this entry.
    const body = structuredClone(stripSystem(entry));
    const already = p.picks.filter((k) => { const a = structuredClone(body); return setTextAtPath(a, k.path, "") && JSON.stringify(a) === JSON.stringify(body); });
    if (already.length) {
      done.push({ contentType: p.contentType, uid: p.uid, locale: TARGET, versionBefore: p.version, versionAfter: entry._version, picks: already, note: "already blanked by an earlier run" });
      console.log(`already blanked: ${already.length} field(s) in ${p.contentType}/${p.uid}`);
    } else failed.push(`${p.contentType}/${p.uid}: version moved (${p.version} → ${entry._version}), skipped`);
    fs.writeFileSync(manifestPath, JSON.stringify({ createdAt: new Date().toISOString(), entries: done }, null, 1));
    continue;
  }
  const attempt = async (picks: Pick[]) => {
    const body = structuredClone(stripSystem(entry));
    for (const k of picks) if (!setTextAtPath(body, k.path, "")) throw new Error(`cannot resolve ${k.path}`);
    await client.put(url, { entry: minimalUpdateBody(body, picks.map((k) => k.path)) }, { locale: TARGET });
    return picks;
  };
  let applied: Pick[] | undefined;
  try { applied = await attempt(p.picks); }
  catch (err) {
    const optional = p.picks.filter((k) => !k.mandatory);
    if (optional.length && optional.length < p.picks.length) {
      try { applied = await attempt(optional); } catch (e2) { failed.push(`${p.contentType}/${p.uid}: ${(e2 as Error).message}`); }
    } else failed.push(`${p.contentType}/${p.uid}: ${(err as Error).message}`);
  }
  if (applied) {
    const { entry: after } = await client.get<{ entry: { _version: number } }>(url, { locale: TARGET });
    done.push({ contentType: p.contentType, uid: p.uid, locale: TARGET, versionBefore: p.version, versionAfter: after._version, picks: applied });
    console.log(`blanked ${applied.length} field(s) in ${p.contentType}/${p.uid} (v${p.version} → v${after._version})`);
  }
  fs.writeFileSync(manifestPath, JSON.stringify({ createdAt: new Date().toISOString(), entries: done }, null, 1)); // written incrementally so a crash can still be restored
}
console.log(`\nDone: ${done.length} entries modified, ${failed.length} skipped/failed. Manifest: ${manifestPath}`);
for (const f of failed) console.log("  ! " + f);
console.log("Nothing was published. Restore with: npm run cs:restore -- " + dir + " --apply");
