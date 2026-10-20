import { Activity, Flag, Globe2, Sparkles } from "lucide-react";
import Link from "next/link";
import { CoverageBars } from "@/components/kpi/coverage-bars";
import { EmptyLive } from "@/components/kpi/empty-live";
import { MetricCard } from "@/components/kpi/metric-card";
import { Provenance } from "@/components/kpi/provenance";
import { ScanControl } from "@/components/kpi/scan-control";
import { ResetDemoButton } from "@/components/localization/reset-demo-button";
import { TrendChart, type TrendPoint } from "@/components/insights/trend-chart";
import { SEVERITY_TONE, STATUS_LABEL } from "@/components/localization/labels";
import { Badge } from "@/components/ui/badge";
import { CsLink } from "@/components/ui/cs-link";
import { csLinks } from "@/lib/domain/cs-links";
import { Button } from "@/components/ui/button";
import { Card, Note, PageHead, SectionTitle } from "@/components/ui/card";
import { loadContext } from "@/lib/server/context";
import { pct } from "@/lib/utils/format";

export default async function OverviewPage() {
  const { mode, view, history, liveConfigured, links } = await loadContext();
  const actions = mode === "live" ? <ScanControl /> : <ResetDemoButton />;

  if (!view) {
    return (
      <>
        <PageHead eyebrow="Content operations · Intelligence overview" title="Connect a stack to begin." sub="Live mode shows only real Contentstack data." />
        <EmptyLive configured={liveConfigured} />
      </>
    );
  }
  const k = view.kpis;
  const top = view.open.slice(0, 6);

  let trend: TrendPoint[] = [];
  let trendNote: string;
  if (mode === "live") {
    trend = history.map((h) => ({ label: new Date(h.at).toLocaleDateString(undefined, { month: "short", day: "numeric" }), value: h.coverage }));
    trendNote = history.length < 2 ? "A real trend appears after at least two scans. No history is invented." : "Coverage % at each completed live scan.";
  } else {
    const offsets = [-18, -15, -16, -11, -9, -5, -2, 0];
    const now = k.overall.percent ?? 0;
    trend = offsets.map((o, i) => ({ label: `W${i + 1}`, value: Math.max(0, Math.min(100, now + o)) }));
    trendNote = "ILLUSTRATIVE ONLY: fixed offsets from today's computed coverage. Not historical data.";
  }

  return (
    <>
      <PageHead
        eyebrow="Content operations · Intelligence overview"
        title="Here's what needs attention."
        sub="An actionable view of content readiness across your markets, computed from explicit localized versions (delivery fallback is never counted as translated)."
        actions={<>{actions}<Link href="/localization"><Button variant={mode === "live" ? "default" : "primary"}>Explore issues →</Button></Link></>}
      />
      <Provenance snapshot={view.snapshot} links={links} />

      <section aria-label="Key metrics" className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Content health" value={k.health === null ? "N/A" : `${k.health}/100`} foot={`${k.bySeverity.critical ?? 0} critical · ${k.openIssues} open findings (weighted rule score)`} icon={Activity} />
        <MetricCard label="Localization coverage" value={pct(k.overall.percent)} foot={`${k.overall.complete} of ${k.overall.eligible} translatable fields explicitly complete`} icon={Globe2} />
        <MetricCard label="Release blockers" value={String(k.blockers)} foot="Critical findings: mandatory fields without an explicit translation" icon={Flag} tone={k.blockers ? "danger" : "accent"} />
        <MetricCard label="Approved proposals" value={String(k.approvedPending)} foot={k.approvedPending ? (mode === "demo" ? "Approved — ready to apply to the demo dataset" : "Approved — NOT written to Contentstack") : "No approved proposals waiting"} icon={Sparkles} tone="amber" />
      </section>

      <div className="mb-5 grid gap-4 xl:grid-cols-[1.24fr_1fr]">
        <Card className="p-5">
          <SectionTitle title="Localization coverage" hint="Explicit localized content, excluding fallback-only values" action={<Link className="text-[11px] font-bold text-accent" href="/localization">Open matrix →</Link>} />
          <CoverageBars rows={k.perLocale} />
        </Card>
        <Card className="p-5">
          <SectionTitle title="Coverage trend" hint={mode === "live" ? "Recorded at each live scan" : "Illustrative weekly snapshot"} />
          {trend.length >= 2 ? <TrendChart data={trend} name="Coverage %" /> : <div className="grid h-[170px] place-items-center rounded-lg border border-dashed border-[#d1dfe0] bg-[#f9fbfb] text-xs text-muted">Not enough scans yet</div>}
          <div className="mt-3"><Note tone={mode === "demo" ? "warn" : "info"}>{trendNote}</Note></div>
        </Card>
      </div>

      <Card className="p-5">
        <SectionTitle title="Priority actions" hint="Open issues ranked by severity, then priority (market, publication, campaign deadline)" action={<Link href="/localization"><Button size="sm">View issue queue →</Button></Link>} />
        {top.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No open issues in this dataset.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-[#8194a0]">
                  {["Content / field", "Market", "Type", "Severity", "Status", ""].map((h) => <th key={h} className="border-b border-[#e8edf0] px-3 py-3 font-extrabold">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {top.map((d) => (
                  <tr key={d.id} className="border-b border-[#eef1f3] last:border-0 hover:bg-[#f5faf9]">
                    <td className="whitespace-nowrap px-3 py-3.5 font-bold text-[#1d3542]">{d.title} <span className="font-normal text-[#9daeb7]">/ {d.fieldLabel}</span></td>
                    <td className="px-3 py-3.5">{d.pointer.locale.toUpperCase()}</td>
                    <td className="whitespace-nowrap px-3 py-3.5">{d.contentTypeTitle}</td>
                    <td className="px-3 py-3.5"><Badge tone={SEVERITY_TONE[d.severity]}>{d.severity}</Badge></td>
                    <td className="whitespace-nowrap px-3 py-3.5">{STATUS_LABEL[d.status]}</td>
                    <td className="space-x-3 whitespace-nowrap px-3 py-3.5 text-right">{links && <CsLink href={csLinks.entry(links, d.pointer.contentTypeUid, d.pointer.locale, d.pointer.entryUid)} label={`Open ${d.title} (${d.pointer.locale}) in Contentstack`} />}<Link className="font-bold text-accent hover:underline" href={`/localization?issue=${d.id}`} aria-label={`Review ${d.title}, ${d.fieldLabel}, ${d.pointer.locale}`}>Review →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
