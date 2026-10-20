import { BarChart3, FileSearch, Search, Sparkles } from "lucide-react";
import { EmptyLive } from "@/components/kpi/empty-live";
import { MetricCard } from "@/components/kpi/metric-card";
import { Provenance } from "@/components/kpi/provenance";
import { ScanControl } from "@/components/kpi/scan-control";
import { ResetDemoButton } from "@/components/localization/reset-demo-button";
import { SeoWorkspace } from "@/components/seo/seo-workspace";
import { Card, Note, PageHead, SectionTitle } from "@/components/ui/card";
import { PENALTY } from "@/lib/domain/seo";
import { loadContext } from "@/lib/server/context";
import { getSeoView } from "@/lib/server/data";

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const Bar = ({ v }: { v: number | null }) => (
  <div className="flex items-center gap-2">
    <div className="h-2 w-24 overflow-hidden rounded-full bg-[#ecf0f0]" role="img" aria-label={v === null ? "Not applicable" : `${v} out of 100`}>
      <div className={`h-full rounded-full ${v === null ? "" : v < 60 ? "bg-[#c86c63]" : v < 80 ? "bg-[#c58a43]" : "bg-[#138778]"}`} style={{ width: `${v ?? 0}%` }} />
    </div>
    <span className="w-8 text-right font-bold">{v ?? "N/A"}</span>
  </div>
);

export default async function SeoPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { mode, audit, status, liveConfigured, links } = await loadContext();
  const view = await getSeoView(mode);
  const head = (
    <PageHead
      eyebrow="SEO & AI discoverability"
      title="Be found. Be quoted."
      sub="Transparent, rule-based checks of search snippets, URLs, images, structure and the signals AI assistants rely on. No hidden AI score: every point traces to a finding. Suggested fixes are reviewed by a human; nothing is written or published."
      actions={mode === "live" ? <ScanControl label="Rescan content" variant="default" /> : <ResetDemoButton />}
    />
  );
  if (!view) return <>{head}<EmptyLive configured={liveConfigured} /></>;
  if (!view.snapshot.seo) {
    return <>{head}<Provenance snapshot={view.snapshot} links={links} /><Card className="mx-auto mt-6 max-w-xl p-8 text-center text-sm text-muted">This scan predates the SEO audit. Run a new scan to build it.{mode === "live" && <div className="mt-4 flex justify-center"><ScanControl /></div>}</Card></>;
  }

  const ruleCounts = view.byRule;
  const quickWins = view.open.filter((f) => f.proposable).length;
  return (
    <>
      {head}
      <Provenance snapshot={view.snapshot} links={links} />
      <section aria-label="Scores" className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="SEO score" value={view.scores.seo === null ? "N/A" : `${view.scores.seo}/100`} foot={`Mean over ${view.applicable.seo} page-like entries`} icon={Search} />
        <MetricCard label="AI discoverability" value={view.scores.ai === null ? "N/A" : `${view.scores.ai}/100`} foot={`Mean over ${view.applicable.ai} articles, FAQs and products`} icon={BarChart3} />
        <MetricCard label="Open findings" value={String(view.open.length)} foot={`${view.bySeverity.high ?? 0} high · ${view.bySeverity.medium ?? 0} medium · ${view.bySeverity.low ?? 0} low`} icon={FileSearch} tone={view.bySeverity.high ? "danger" : "accent"} />
        <MetricCard label="AI-assisted fixes" value={String(quickWins)} foot="Text findings with a reviewable suggestion" icon={Sparkles} tone="amber" />
      </section>

      <div className="mb-5 grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Card className="p-5">
          <SectionTitle title="By content type" hint="Mean entry scores; N/A where a rule family does not apply to the type" />
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-left text-[10px] uppercase tracking-wider text-[#8194a0]"><th className="py-2">Content type</th><th>SEO</th><th>AI discoverability</th><th className="text-right">Open</th></tr></thead>
              <tbody>{view.byType.map((t) => <tr key={t.uid} className="border-t border-[#eef1f3]"><td className="py-2.5 font-bold">{t.title}</td><td><Bar v={t.seo} /></td><td><Bar v={t.ai} /></td><td className="text-right font-bold">{t.open}</td></tr>)}</tbody>
            </table>
          </div>
        </Card>
        <Card className="p-5">
          <SectionTitle title="How scores work" hint="score = 100 − Σ penalties, per entry; site score = mean over applicable entries" />
          <table className="w-full text-xs">
            <tbody>{(["high", "medium", "low"] as const).map((s) => <tr key={s} className="border-t border-[#eef1f3] first:border-0"><td className="py-2 font-bold capitalize">{s}</td><td className="text-muted">−{PENALTY[s]} points each</td><td className="text-right font-bold">{view.bySeverity[s] ?? 0}</td></tr>)}</tbody>
          </table>
          <div className="mt-3"><Note>Page-like = has a URL or meta fields. AI-applicable = articles, FAQs and products, detected from the <em>schema</em>, not from content-type names. Content-type (schema) findings are listed but do not change entry scores. This is a heuristic, not a ranking prediction.</Note></div>
        </Card>
      </div>

      <SeoWorkspace
        mode={mode}
        findings={view.findings}
        proposals={view.proposals}
        audit={audit}
        contentTypes={view.snapshot.contentTypes.map((c) => ({ uid: c.uid, title: c.title }))}
        links={links}
        flags={{ aiTransferAllowed: status.openai.contentTransferAllowed, openaiConfigured: status.openai.configured, model: status.openai.model, reasoningEffort: status.openai.reasoningEffort }}
        initial={{ finding: one(sp.finding), rule: one(sp.rule), category: one(sp.category) }}
        ruleCounts={ruleCounts}
      />
    </>
  );
}
