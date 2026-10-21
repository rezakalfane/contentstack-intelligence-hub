import { Gauge, Layers, ShieldAlert, Wrench } from "lucide-react";
import { EmptyLive } from "@/components/kpi/empty-live";
import { MetricCard } from "@/components/kpi/metric-card";
import { Provenance } from "@/components/kpi/provenance";
import { ScanControl } from "@/components/kpi/scan-control";
import { ResetDemoButton } from "@/components/localization/reset-demo-button";
import { SchemaWorkspace, type SlimType } from "@/components/schema/schema-workspace";
import { Card, Note, PageHead } from "@/components/ui/card";
import { analyzeSchemas, PENALTY } from "@/lib/domain/schema-governance";
import { loadContext } from "@/lib/server/context";
import { getSnapshot } from "@/lib/server/data";

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function SchemaPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { mode, liveConfigured, links } = await loadContext();
  const snapshot = await getSnapshot(mode);
  const head = (
    <PageHead
      eyebrow="Schema governance"
      title="Keep the model simple enough to change."
      sub="Complexity, redundancy and change-risk recommendations for your content types, from real field usage and real references. Rule-based and explainable; the tool never edits a schema."
      actions={mode === "live" ? <ScanControl label="Rescan schema" variant="default" /> : <ResetDemoButton />}
    />
  );
  if (!snapshot) return <>{head}<EmptyLive configured={liveConfigured} /></>;
  if (!snapshot.schemas || !snapshot.fieldUsage) {
    return <>{head}<Provenance snapshot={snapshot} links={links} /><Card className="mx-auto mt-6 max-w-xl p-8 text-center text-sm text-muted">This scan predates schema governance. Run a new scan to build it.{mode === "live" && <div className="mt-4 flex justify-center"><ScanControl /></div>}</Card></>;
  }

  const a = analyzeSchemas({ schemas: snapshot.schemas, usage: snapshot.fieldUsage, graph: snapshot.graph, localeCount: snapshot.locales.length });
  const types: SlimType[] = a.types.map((t) => ({
    ...t,
    fieldRows: t.fieldRows.map((r) => ({ path: r.path, depth: r.depth, kind: r.kind, uid: r.field.uid, displayName: r.field.displayName, dataType: r.kind === "block_type" ? "blocks" : r.field.dataType, mandatory: r.field.mandatory, nonLocalizable: r.field.nonLocalizable, multiple: r.field.multiple, filled: r.filled, total: r.total })),
  }));
  const ruleCounts = a.findings.reduce<Record<string, number>>((m, f) => ((m[f.ruleId] = (m[f.ruleId] ?? 0) + 1), m), {});
  const sev = (s: string) => a.findings.filter((f) => f.severity === s).length;
  const riskiest = [...a.types].sort((x, y) => y.risk.score - x.risk.score)[0];

  return (
    <>
      {head}
      <Provenance snapshot={snapshot} links={links} />
      <section aria-label="Schema scores" className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Governance score" value={a.score === null ? "N/A" : `${a.score}/100`} foot={`Mean over ${a.types.filter((t) => t.fields > 0).length} content types`} icon={Gauge} />
        <MetricCard label="Content types" value={String(a.totals.types)} foot={`${a.totals.fields} fields · ${a.totals.entries} entries scanned`} icon={Layers} />
        <MetricCard label="Recommendations" value={String(a.findings.length)} foot={`${sev("high")} high · ${sev("medium")} medium · ${sev("low")} low`} icon={Wrench} tone={sev("high") ? "danger" : "accent"} />
        <MetricCard label="Riskiest to change" value={riskiest ? riskiest.title : "—"} foot={riskiest ? `Risk ${riskiest.risk.score} · ${riskiest.inbound.entries} inbound references` : ""} icon={ShieldAlert} tone="amber" />
      </section>
      <div className="mb-5"><Note>Score per content type = 100 − Σ penalties (high {PENALTY.high}, medium {PENALTY.medium}, low {PENALTY.low}); the stack score is the mean. Usage comes from {snapshot.masterLocale} entries only, so a field used only in other locales looks unused; confidence needs at least 5 entries per type. A heuristic to prioritise clean-up, not a verdict.</Note></div>
      <SchemaWorkspace types={types} findings={a.findings} similarity={a.similarity} links={links} masterLocale={snapshot.masterLocale} localeCount={snapshot.locales.length} initial={{ type: one(sp.type), rule: one(sp.rule) }} ruleCounts={ruleCounts} />
    </>
  );
}
