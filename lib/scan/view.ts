import { deriveDiagnostics } from "@/lib/domain/rules";
import { acceptanceRate, coverage, coverageBy, healthScore } from "@/lib/domain/scoring";
import { effectiveText } from "@/lib/domain/review";
import type {
  CoverageCell, LocalizationDiagnostic, Snapshot, TranslatableUnit, TranslationProposal,
} from "@/lib/domain/types";

export interface Kpis {
  eligibleUnits: number;
  overall: CoverageCell;
  health: number | null;
  openIssues: number;
  blockers: number;
  approvedPending: number;
  approved: number;
  rejected: number;
  acceptance: number | null;
  proposals: number;
  estimatedUsd: number | null;
  actualUsd: number | null;
  perLocale: { locale: string; name: string; cell: CoverageCell }[];
  matrix: { contentTypeUid: string; title: string; cells: Record<string, CoverageCell> }[];
  byRule: Record<string, number>;
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
}

export interface View {
  snapshot: Snapshot;
  units: TranslatableUnit[];
  /** All diagnostics, including resolved (applied-to-demo) ones. */
  diagnostics: LocalizationDiagnostic[];
  open: LocalizationDiagnostic[];
  proposals: Record<string, TranslationProposal>; // by issue id
  kpis: Kpis;
}

export function buildView(snapshot: Snapshot, allProposals: TranslationProposal[], now: Date): View {
  const proposalList = allProposals.filter((p) => p.task !== "seo"); // SEO suggestions have their own view
  const byUnit = new Map(proposalList.map((p) => [p.unitKey, p]));
  const applied = new Map(
    proposalList.filter((p) => p.appliedToDemo && snapshot.mode === "demo").map((p) => [p.unitKey, effectiveText(p)]),
  );

  // Diagnostics come from the scan; the demo overlay only resolves them (never edits fixtures on disk).
  const diagnostics = deriveDiagnostics(snapshot.units, snapshot.entryLocales, { criticalLocales: snapshot.policy.criticalLocales, now })
    .map((d) => (applied.has(d.unitKey) ? { ...d, status: "resolved" as const } : d));

  const units = snapshot.units.map((u) => {
    const text = applied.get(u.key);
    return text === undefined
      ? u
      : { ...u, targetText: text, completeness: "complete" as const, existence: "exists" as const, freshness: "current" as const, evidence: [...u.evidence, "Applied to demo dataset"] };
  });
  const open = diagnostics.filter((d) => d.status !== "resolved");

  const matrix = snapshot.contentTypes.map((ct) => ({
    contentTypeUid: ct.uid,
    title: ct.title,
    cells: Object.fromEntries(
      snapshot.locales
        .filter((l) => l.code !== snapshot.masterLocale)
        .map((l) => [l.code, coverage(units.filter((u) => u.pointer.contentTypeUid === ct.uid && u.pointer.locale === l.code))]),
    ),
  }));

  const perLocaleCells = coverageBy(units, (u) => u.pointer.locale);
  const proposals = proposalList.filter((p) => p.status !== "not_requested");
  const approvedList = proposals.filter((p) => ["approved", "write_pending", "written", "write_failed"].includes(p.status));
  const approved = approvedList.length;
  const rejected = proposals.filter((p) => p.status === "rejected").length;
  const sum = (xs: (number | undefined)[]) => {
    const known = xs.filter((x): x is number => typeof x === "number");
    return known.length ? known.reduce((a, b) => a + b, 0) : null;
  };
  const tally = (pick: (d: LocalizationDiagnostic) => string[]) => {
    const out: Record<string, number> = {};
    for (const d of open) for (const k of pick(d)) out[k] = (out[k] ?? 0) + 1;
    return out;
  };
  const eligibleUnits = units.filter((u) => u.completeness !== "not_applicable").length;

  const kpis: Kpis = {
    eligibleUnits,
    overall: coverage(units),
    health: healthScore(open, eligibleUnits),
    openIssues: open.length,
    blockers: open.filter((d) => d.severity === "critical").length,
    approvedPending: approvedList.filter((p) => !p.appliedToDemo && p.status === "approved").length,
    approved,
    rejected,
    acceptance: acceptanceRate(approved, rejected),
    proposals: proposals.length,
    estimatedUsd: sum(proposals.map((p) => p.estimatedUsd)),
    actualUsd: sum(proposals.map((p) => p.actualUsd)),
    perLocale: snapshot.locales
      .filter((l) => l.code !== snapshot.masterLocale)
      .map((l) => ({ locale: l.code, name: l.name, cell: perLocaleCells.get(l.code) ?? { eligible: 0, complete: 0, percent: null } })),
    matrix,
    byRule: tally((d) => d.ruleIds),
    bySeverity: tally((d) => [d.severity]),
    byStatus: tally((d) => [d.status]),
  };

  const proposalsByIssue: Record<string, TranslationProposal> = {};
  for (const d of diagnostics) {
    const p = byUnit.get(d.unitKey);
    if (p) proposalsByIssue[d.id] = p;
  }
  return { snapshot, units, diagnostics, open, proposals: proposalsByIssue, kpis };
}
