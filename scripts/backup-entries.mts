// Read-only. Saves every en-us and fr-fr entry (raw CMA JSON) plus content type schemas.
// Usage: npm run cs:backup      → backups/<timestamp>/backup.json   (gitignored; contains real content)
import fs from "node:fs";
import path from "node:path";
import { branch, client, MASTER, TARGET } from "./_cs.mts";

interface RawEntry { uid: string; [k: string]: unknown }
const { content_types } = await client.get<{ content_types: { uid: string }[] }>("/content_types", { limit: 100, include_global_field_schema: true });
const entries: { contentType: string; uid: string; locale: string; entry: RawEntry }[] = [];

for (const ct of content_types) {
  const list: RawEntry[] = [];
  for (let skip = 0; ; skip += 100) {
    const r = await client.get<{ entries: RawEntry[] }>(`/content_types/${ct.uid}/entries`, { locale: MASTER, limit: 100, skip });
    list.push(...r.entries);
    if (r.entries.length < 100) break;
  }
  for (const e of list) {
    const { locales } = await client.get<{ locales: { code: string; localized?: boolean }[] }>(`/content_types/${ct.uid}/entries/${e.uid}/locales`);
    for (const code of [MASTER, TARGET]) {
      if (code !== MASTER && !locales.some((l) => l.code === code && l.localized)) continue;
      const { entry } = await client.get<{ entry: RawEntry }>(`/content_types/${ct.uid}/entries/${e.uid}`, { locale: code, include_publish_details: true });
      entries.push({ contentType: ct.uid, uid: e.uid, locale: code, entry });
    }
  }
  process.stdout.write(`${ct.uid}: ${list.length} entries\n`);
}

const dir = path.join("backups", new Date().toISOString().replace(/[:.]/g, "-"));
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "backup.json"), JSON.stringify({ createdAt: new Date().toISOString(), branch, masterLocale: MASTER, targetLocale: TARGET, contentTypes: content_types, entries }));
fs.chmodSync(path.join(dir, "backup.json"), 0o600);
console.log(`\nSaved ${entries.length} entry versions (${entries.filter((e) => e.locale === TARGET).length} ${TARGET}) → ${dir}/backup.json  [${client.callCount} API calls]`);
