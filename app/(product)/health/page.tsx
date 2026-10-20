import { EmptyLive } from "@/components/kpi/empty-live";
import { Provenance } from "@/components/kpi/provenance";
import { HealthTable } from "@/components/health/health-table";
import { Card, Note, PageHead, SectionTitle } from "@/components/ui/card";
import { RULES, SEVERITY_WEIGHT } from "@/lib/domain/rules";
import type { Severity } from "@/lib/domain/types";
import { loadContext } from "@/lib/server/context";

export default async function HealthPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { view, liveConfigured, links } = await loadContext();
  const head = <PageHead eyebrow="Content Health Radar" title="Measure what matters. Fix what breaks." sub="Transparent, rule-based auditing. Every score is reproducible from the findings below; there is no hidden model." />;
  if (!view) return <>{head}<EmptyLive configured={liveConfigured} /></>;

  const k = view.kpis;
  const sevs: Severity[] = ["critical", "high", "medium", "low"];
  const weighted = sevs.reduce((n, s) => n + (k.bySeverity[s] ?? 0) * SEVERITY_WEIGHT[s], 0);

  return (
    <>
      {head}
      <Provenance snapshot={view.snapshot} links={links} />
      <div className="mb-5 grid gap-4 md:grid-cols-3">
        {[
          ["Overall score", k.health === null ? "N/A" : `${k.health}/100`, "Heuristic weighted rule score, not a validated grade"],
          ["Open diagnostics", String(k.openIssues), "Findings requiring attention"],
          ["Critical blockers", String(k.blockers), "Mandatory fields lacking an explicit translation"],
        ].map(([t, v, s]) => (
          <Card key={t} className="p-5"><div className="text-[25px] font-extrabold">{v}</div><h3 className="mt-2 text-sm font-bold">{t}</h3><p className="mt-1 text-xs text-muted">{s}</p></Card>
        ))}
      </div>

      <div className="mb-5 grid gap-4 xl:grid-cols-2">
        <Card className="p-5">
          <SectionTitle title="Score breakdown" hint="healthScore = round(100 × max(0, 1 − weighted ÷ (5 × eligible fields)))" />
          <table className="w-full text-xs">
            <thead><tr className="text-left text-[10px] uppercase tracking-wider text-[#8194a0]"><th className="py-2">Severity</th><th>Weight</th><th>Findings</th><th className="text-right">Contribution</th></tr></thead>
            <tbody>
              {sevs.map((s) => (
                <tr key={s} className="border-t border-[#eef1f3]"><td className="py-2.5 font-bold capitalize">{s}</td><td>{SEVERITY_WEIGHT[s]}</td><td>{k.bySeverity[s] ?? 0}</td><td className="text-right">{(k.bySeverity[s] ?? 0) * SEVERITY_WEIGHT[s]}</td></tr>
              ))}
              <tr className="border-t-2 border-line font-bold"><td className="py-2.5" colSpan={3}>Weighted findings</td><td className="text-right">{weighted}</td></tr>
            </tbody>
          </table>
          <div className="mt-3"><Note>Denominator: 5 × {k.eligibleUnits} eligible translatable fields = {5 * k.eligibleUnits}. Score = {k.health === null ? "N/A (no eligible fields)" : `${k.health}`}. A single score can hide a critical blocker, so blockers are always shown separately.</Note></div>
        </Card>
        <Card className="p-5">
          <SectionTitle title="Quality rules" hint="Executable rules; click a count to filter the findings" />
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-left text-[10px] uppercase tracking-wider text-[#8194a0]"><th className="py-2">Rule</th><th>Detection logic</th><th>Open</th></tr></thead>
              <tbody>
                {Object.entries(RULES).map(([id, r]) => (
                  <tr key={id} className="border-t border-[#eef1f3] align-top">
                    <td className="whitespace-nowrap py-2.5 pr-3 font-bold">{id}<br /><span className="font-normal text-muted">{r.title}</span></td>
                    <td className="pr-3 text-[#46606f]">{r.logic}</td>
                    <td className="font-bold"><a className="text-accent hover:underline" href={`/health?rule=${id}`}>{k.byRule[id] ?? 0}</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <SectionTitle title="Findings" hint="Severity, evidence, remediation and affected market/page for each open finding" />
        <HealthTable masterLocale={view.snapshot.masterLocale} links={links} issues={view.open} initialRule={sp.rule && sp.rule in RULES ? sp.rule : "all"} />
      </Card>
    </>
  );
}
