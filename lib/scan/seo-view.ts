import { effectiveText } from "@/lib/domain/review";
import { applyTextOverrides, auditSeo, scoreSeo, type SeoScores } from "@/lib/domain/seo";
import type { SeoFacts, SeoFinding, Snapshot, TranslationProposal } from "@/lib/domain/types";

export interface SeoView {
  snapshot: Snapshot;
  facts: SeoFacts[];
  /** All findings including ones resolved by an applied (demo) suggestion. */
  findings: SeoFinding[];
  open: SeoFinding[];
  scores: SeoScores;
  byRule: Record<string, number>;
  byCategory: { seo: number; ai: number };
  bySeverity: Record<string, number>;
  byType: { uid: string; title: string; seo: number | null; ai: number | null; open: number }[];
  proposals: Record<string, TranslationProposal>; // by finding id
  applicable: { seo: number; ai: number };
}

export const seoUnitKey = (findingId: string) => `seo:${findingId}`;

export function buildSeoView(snapshot: Snapshot, proposalList: TranslationProposal[], now: Date): SeoView | null {
  if (!snapshot.seo) return null;
  const seoProposals = proposalList.filter((p) => p.task === "seo");
  const overrides = new Map<string, string>();
  if (snapshot.mode === "demo") {
    for (const p of seoProposals) if (p.appliedToDemo) overrides.set(`${p.pointer.contentTypeUid}/${p.pointer.entryUid}|${p.pointer.fieldPath}`, effectiveText(p));
  }
  const base = auditSeo(snapshot.seo, now);
  const facts = overrides.size ? applyTextOverrides(snapshot.seo, overrides) : snapshot.seo;
  const after = overrides.size ? auditSeo(facts, now) : base;
  const stillOpen = new Set(after.map((f) => f.id));
  const findings: SeoFinding[] = [
    ...base.map((f) => (stillOpen.has(f.id) ? (after.find((a) => a.id === f.id) as SeoFinding) : { ...f, status: "resolved" as const })),
    ...after.filter((a) => !base.some((b) => b.id === a.id)), // findings introduced by an applied suggestion
  ];
  const open = findings.filter((f) => f.status === "open");
  const scores = scoreSeo(facts, open);

  const tally = <K extends string>(pick: (f: SeoFinding) => K) => open.reduce<Record<string, number>>((m, f) => ((m[pick(f)] = (m[pick(f)] ?? 0) + 1), m), {});
  const types = new Map<string, { title: string; seo: number[]; ai: number[]; open: number }>();
  for (const f of facts) {
    const t = types.get(f.contentTypeUid) ?? { title: f.contentTypeTitle, seo: [], ai: [], open: 0 };
    const s = scores.perEntry.get(f.id);
    if (s?.seo !== undefined) t.seo.push(s.seo);
    if (s?.ai !== undefined) t.ai.push(s.ai);
    types.set(f.contentTypeUid, t);
  }
  for (const f of open) {
    const t = types.get(f.contentTypeUid);
    if (t) t.open++;
  }
  const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

  const proposals: Record<string, TranslationProposal> = {};
  const byKey = new Map(seoProposals.map((p) => [p.unitKey, p]));
  for (const f of findings) {
    const p = byKey.get(seoUnitKey(f.id));
    if (p) proposals[f.id] = p;
  }
  return {
    snapshot, facts, findings, open, scores,
    byRule: tally((f) => f.ruleId),
    byCategory: { seo: open.filter((f) => f.category === "seo").length, ai: open.filter((f) => f.category === "ai").length },
    bySeverity: tally((f) => f.severity),
    byType: [...types].map(([uid, t]) => ({ uid, title: t.title, seo: mean(t.seo), ai: mean(t.ai), open: t.open })),
    proposals,
    applicable: { seo: scores.seoEntries, ai: scores.aiEntries },
  };
}
