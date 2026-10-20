// Read-only smoke test against the real Contentstack stack. Usage: npm run live:scan
// Prints counts only (no tokens, no content bodies).
import { CmaClient } from "../lib/adapters/cma-client";
import { createLiveAdapter } from "../lib/adapters/live-adapter";
import { runScan } from "../lib/scan/scan";
import { buildView } from "../lib/scan/view";

process.loadEnvFile(".env.local");
const HOSTS: Record<string, string> = { eu: "https://eu-api.contentstack.com", na: "https://api.contentstack.io" };
const base = process.env.CONTENTSTACK_API_BASE_URL ?? HOSTS[(process.env.CONTENTSTACK_REGION ?? "na").toLowerCase()];
if (!base || !process.env.CONTENTSTACK_API_KEY || !process.env.CONTENTSTACK_MANAGEMENT_TOKEN) throw new Error("Missing Contentstack env");

const client = new CmaClient({ base, apiKey: process.env.CONTENTSTACK_API_KEY, token: process.env.CONTENTSTACK_MANAGEMENT_TOKEN, branch: process.env.CONTENTSTACK_BRANCH ?? "main" });
const adapter = createLiveAdapter({ client, region: "eu", branch: process.env.CONTENTSTACK_BRANCH ?? "main", environment: process.env.CONTENTSTACK_ENVIRONMENT });

const t0 = Date.now();
const snap = await runScan(adapter, { baselines: new Map(), maxEntriesPerType: 200, concurrency: 3, criticalLocales: [], provenance: "LIVE · Contentstack", onProgress: (p) => process.stdout.write(`\r${p.phase} ${p.done}/${p.total}      `) });
const view = buildView(snap, [], new Date());
console.log(`\nstatus=${snap.status} calls=${client.callCount} ms=${Date.now() - t0}`);
console.log("locales:", snap.locales.map((l) => `${l.code}(fb:${l.fallbackLocale})`).join(", "), "master:", snap.masterLocale, "env:", snap.environment);
console.log("types:", snap.contentTypes.map((c) => `${c.uid}=${c.entries}`).join(", "));
console.log("units:", snap.units.length, "entryLocales:", snap.entryLocales.length, "errors:", snap.errors.length, snap.errors.slice(0, 5));
console.log("existence:", Object.entries(snap.entryLocales.reduce<Record<string, number>>((a, e) => ((a[e.existence] = (a[e.existence] ?? 0) + 1), a), {})));
console.log("coverage:", view.kpis.overall, "health:", view.kpis.health, "open:", view.kpis.openIssues, "byRule:", view.kpis.byRule, "bySev:", view.kpis.bySeverity);
console.log("sample open:", view.open.slice(0, 5).map((d) => `${d.severity} ${d.ruleIds} ${d.pointer.contentTypeUid}/${d.pointer.entryUid} ${d.pointer.locale} ${d.pointer.fieldPath}`));
console.log("errors:", snap.errors.map((e) => `${e.scope}: ${e.message}`));
for (const d of view.open.slice(0, 6)) console.log("issue:", d.title, "|", d.fieldLabel, "|", JSON.stringify(d.sourceText.slice(0, 80)), "|", d.evidence.join(" "));
