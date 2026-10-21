import { Badge } from "@/components/ui/badge";
import { Card, Note, PageHead } from "@/components/ui/card";

const MODULES = [
  { n: "01", name: "LocaleOps — localization command center", phase: "Built (P0)", tone: "live" as const, effort: "M", impact: "5/5", overlap: "Contentstack has localization, partner and automation options; this adds cross-locale, field-level coverage and reviewable AI fixes with provenance.", body: "Locale × content-type matrix, explicit-locale detection, reviewable proposals." },
  { n: "02", name: "Content Health Radar", phase: "Built (P0)", tone: "live" as const, effort: "S/M", impact: "5/5", overlap: "Native analytics cover usage and lifecycle; this explains what to fix next with transparent rules.", body: "Executable rules, score breakdown, drill-down to evidence." },
  { n: "03", name: "Content-to-Commerce Intelligence", phase: "P2", tone: "neutral" as const, effort: "L", impact: "5/5", overlap: "Integrations exist; the gap is joining CMS issues to real pages/SKUs and traffic.", body: "Needs authorised GA4 + BigCommerce data. Never simulated." },
  { n: "04", name: "Campaign Release Guardian", phase: "P1", tone: "neutral" as const, effort: "M/L", impact: "5/5", overlap: "Workflow/publishing rules exist; this aggregates readiness across regions and dependencies.", body: "Explicit blockers, not one arbitrary percentage." },
  { n: "05", name: "Reference Impact Graph", phase: "Built (P1)", tone: "live" as const, effort: "M/L", impact: "4/5", overlap: "Reference lookup exists per entry; blast-radius preview before edits is the extension.", body: "Interactive force graph of entry and asset references with blast-radius preview, broken-reference and orphan detection." },
  { n: "06", name: "SEO & AI discoverability audit", phase: "Built (P1)", tone: "live" as const, effort: "M", impact: "4/5", overlap: "AI assistance exists; this audits field quality with human review.", body: "16 transparent rules across SEO and AI discoverability, schema-derived scoring, and human-reviewed AI suggestions for meta text." },
  { n: "07", name: "Multi-market consistency monitor", phase: "P2", tone: "neutral" as const, effort: "M/L", impact: "4/5", overlap: "Largely unaddressed natively (verify on the tenant).", body: "Inconsistent claims, offers and disclaimers across markets." },
  { n: "08", name: "Editorial bottleneck predictor", phase: "P3", tone: "neutral" as const, effort: "L", impact: "4/5", overlap: "Native reports are descriptive; forecasting is the extension.", body: "Delay-risk forecasts from workflow history." },
  { n: "09", name: "Schema governance", phase: "Built (P2)", tone: "live" as const, effort: "M", impact: "4/5", overlap: "Schema tooling exists; complexity/redundancy/change-risk advice is the extension.", body: "Complexity score, unused and redundant fields, Global Field candidates, localization-setting hygiene and per-type change risk from real usage and references." },
  { n: "10", name: "AI Operations ROI", phase: "Started (P1)", tone: "info" as const, effort: "M", impact: "4/5", overlap: "Vendor usage dashboards exist; accepted-output cost and rework are tool-level.", body: "Acceptance rate and cost per accepted translation already derived from review events." },
];

export default function RoadmapPage() {
  return (
    <>
      <PageHead eyebrow="Strategy · Product opportunities" title="Ten opportunities. One coherent product." sub="Deliberately complementary to Contentstack's Agent OS, automation and analytics. Rankings are product judgment, not market data." />
      <div className="mb-5"><Note>These are extension opportunities based on public documentation as of 20 Oct 2026, not verified missing features. Plan, region and deployment affect availability; verify on the target tenant before making definitive claims.</Note></div>
      <div className="grid gap-3.5 md:grid-cols-2">
        {MODULES.map((m) => (
          <Card key={m.n} className="p-5">
            <div className="flex items-center justify-between"><Badge tone={m.tone}>{m.phase}</Badge><span className="text-[11px] text-muted">Effort {m.effort} · Value {m.impact}</span></div>
            <div className="eyebrow mt-4">Opportunity {m.n}</div>
            <h2 className="my-2 text-[15px] font-bold">{m.name}</h2>
            <p className="text-xs leading-relaxed text-[#788c99]">{m.body}</p>
            <p className="mt-2 text-[11px] leading-relaxed text-muted"><strong>Native overlap:</strong> {m.overlap}</p>
          </Card>
        ))}
      </div>
      <Card className="mt-5 p-5">
        <h2 className="text-[15px] font-bold">Boundaries of this prototype</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-[#46606f]">
          <li>Reads Contentstack with the Content Management API only. Live CMS writes are off by default and never publish.</li>
          <li>Approving a proposal records a decision; it is not a CMS write, and not publication.</li>
          <li>Review state is stored in local JSON files, with no database or user accounts. Postgres + real auth are the production path.</li>
          <li>Trend, GA4 and commerce signals are not shown unless backed by real recorded data.</li>
        </ul>
      </Card>
    </>
  );
}
