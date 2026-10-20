// Read-only: compare current fr-fr entries with a backup and list differences in translatable text.
import fs from "node:fs";
import path from "node:path";
import { extractLeaves, normalizeContentType, type RawContentType } from "../lib/domain/normalizer.ts";
import { arg, client, TARGET } from "./_cs.mts";

const backup = JSON.parse(fs.readFileSync(path.join(arg(0) as string, "backup.json"), "utf8"));
const cts = new Map(backup.contentTypes.map((c: RawContentType) => [c.uid, normalizeContentType(c, new Map())]));
let changedEntries = 0, changedFields = 0;
for (const row of backup.entries.filter((e: { locale: string }) => e.locale === TARGET)) {
  const ct = cts.get(row.contentType)!;
  const { entry } = await client.get<{ entry: Record<string, unknown> & { _version: number } }>(`/content_types/${row.contentType}/entries/${row.uid}`, { locale: TARGET });
  const before = new Map(extractLeaves(ct.schema, row.entry).map((l) => [l.path, l.text]));
  const diffs = extractLeaves(ct.schema, entry).filter((l) => before.has(l.path) && before.get(l.path) !== l.text);
  if (entry._version !== row.entry._version || diffs.length) {
    changedEntries++; changedFields += diffs.length;
    console.log(`${row.contentType}/${row.uid}: v${row.entry._version} → v${entry._version}, ${diffs.length} changed field(s): ${diffs.map((d) => `${d.path}=${JSON.stringify(d.text.slice(0, 20))}`).join("; ")}`);
  }
}
console.log(`\n${changedEntries} entries differ from backup (${changedFields} text fields changed)`);
