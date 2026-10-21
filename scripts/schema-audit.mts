// Read-only: scan the live stack and print the schema-governance analysis (counts and short evidence only).
import { createLiveAdapter } from "../lib/adapters/live-adapter";
import { analyzeSchemas } from "../lib/domain/schema-governance";
import { runScan } from "../lib/scan/scan";
import { branch, client } from "./_cs.mts";

const adapter = createLiveAdapter({ client, region: "eu", branch, environment: process.env.CONTENTSTACK_ENVIRONMENT });
const snap = await runScan(adapter, { baselines: new Map(), maxEntriesPerType: 200, concurrency: 3, criticalLocales: [], provenance: "LIVE" });
const a = analyzeSchemas({ schemas: snap.schemas ?? [], usage: snap.fieldUsage ?? [], graph: snap.graph, localeCount: snap.locales.length });
console.log(`types=${a.totals.types} fields=${a.totals.fields} entries=${a.totals.entries} score=${a.score} findings=${a.findings.length}`);
console.table(a.types.map((t) => ({ type: t.uid, entries: t.entries, fields: t.fields, depth: t.maxDepth, blocks: t.blockTypes, complexity: `${t.complexity} ${t.complexityBand}`, risk: `${t.risk.score} ${t.risk.band}`, in: `${t.inbound.entries}/${t.inbound.types}`, findings: t.findings, score: t.score })));
const by: Record<string, number> = {};
for (const f of a.findings) by[f.ruleId] = (by[f.ruleId] ?? 0) + 1;
console.log("by rule:", by);
const seen = new Set<string>();
for (const f of a.findings) if (!seen.has(f.ruleId)) { seen.add(f.ruleId); console.log(` ${f.ruleId} [${f.severity}] ${f.contentTypeUid} → ${f.message} | ${f.evidence[0]?.slice(0, 100)}`); }
console.log("top similarity:", a.similarity.filter((s) => s.shared.length).sort((x, y) => y.shared.length - x.shared.length).slice(0, 3).map((s) => `${s.a}~${s.b} ${s.shared.length} shared (${Math.round(s.score * 100)}%)`));
