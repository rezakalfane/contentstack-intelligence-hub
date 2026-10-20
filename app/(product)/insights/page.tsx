import { CoverageByTypeChart, IssuesByLocaleChart } from "@/components/insights/charts";
import { EmptyLive } from "@/components/kpi/empty-live";
import { Provenance } from "@/components/kpi/provenance";
import { Badge } from "@/components/ui/badge";
import { Card, Note, PageHead, SectionTitle } from "@/components/ui/card";
import { loadContext } from "@/lib/server/context";
import { pct, usd } from "@/lib/utils/format";

export default async function InsightsPage() {
  const { mode, view, liveConfigured, links } = await loadContext();
  const head = <PageHead eyebrow="Insights · Content operations" title="From content issues to business priorities." sub="Coverage and quality breakdowns from the current dataset. Business-impact joins are a clearly-marked future integration; no revenue is invented." />;
  if (!view) return <>{head}<EmptyLive configured={liveConfigured} /></>;
  const k = view.kpis;

  const byLocale = k.perLocale.map(({ locale }) => {
    const mine = view.open.filter((d) => d.pointer.locale === locale);
    const n = (s: string) => mine.filter((d) => d.severity === s).length;
    return { locale: locale.toUpperCase(), critical: n("critical"), high: n("high"), medium: n("medium"), low: n("low") };
  });
  const byType = k.matrix.map((m) => {
    const cells = Object.values(m.cells);
    const eligible = cells.reduce((a, c) => a + c.eligible, 0);
    const complete = cells.reduce((a, c) => a + c.complete, 0);
    return { type: m.title, coverage: eligible ? Math.round((100 * complete) / eligible) : null };
  });
  const sim = view.snapshot.mode === "demo";

  return (
    <>
      {head}
      <Provenance snapshot={view.snapshot} links={links} />
      <div className="mb-5 grid gap-4 xl:grid-cols-2">
        <Card className="p-5"><SectionTitle title="Open issues by market" hint="Stacked by severity" /><IssuesByLocaleChart data={byLocale} /></Card>
        <Card className="p-5"><SectionTitle title="Coverage by content type" hint="Across all target locales" /><CoverageByTypeChart data={byType} /></Card>
      </div>

      <div className="mb-5 grid gap-4 xl:grid-cols-2">
        <Card className="p-5">
          <SectionTitle title="AI operations" hint="Reviewed proposals in this dataset" action={<Badge tone={sim ? "demo" : "live"}>{sim ? "Demo: simulated" : "Live: OpenAI"}</Badge>} />
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            {[
              ["Proposals", String(k.proposals)],
              ["Approved", String(k.approved)],
              ["Rejected", String(k.rejected)],
              ["Acceptance rate", k.acceptance === null ? "—" : pct(Math.round(k.acceptance * 100))],
              [sim ? "Est. cost" : "Cost (computed)", sim ? "n/a" : usd(k.actualUsd)],
              ["Cost / accepted", !sim && k.actualUsd !== null && k.approved ? usd(k.actualUsd / k.approved) : "—"],
            ].map(([t, v]) => <div key={t}><dt className="text-[11px] text-muted">{t}</dt><dd className="text-xl font-bold">{v}</dd></div>)}
          </dl>
          <div className="mt-3"><Note tone={sim ? "warn" : "info"}>{sim ? "Counts reflect demo review actions on simulated proposals. No model was called and no cost was incurred." : "Cost is reported token usage × the prices you configure (OPENAI_PRICE_*). Without prices it shows “—”, never $0."}</Note></div>
        </Card>
        <Card className="p-5">
          <SectionTitle title="Future: Content → Commerce" hint="Requires authorised GA4 / BigCommerce data and an authoritative page/SKU mapping" action={<Badge tone="neutral">Planned · P2</Badge>} />
          <div className="rounded-lg border border-dashed border-[#d1dfe0] bg-[#f9fbfb] p-8 text-center text-xs leading-relaxed text-[#779099]">
            Revenue influence, high-traffic-page risk and SKU-level content opportunities will appear here after real integrations exist.
            <br /><strong>No revenue or traffic numbers are shown or simulated.</strong> Today, priority uses categorical rules (severity, market, publication, campaign deadline).
          </div>
        </Card>
      </div>
      <p className="text-[11px] text-muted">Mode: {mode === "live" ? "LIVE · Contentstack" : "DEMO · Sample fixtures"}. Rule distribution: {Object.entries(k.byRule).map(([r, n]) => `${r}: ${n}`).join(" · ") || "no open findings"}.</p>
    </>
  );
}
