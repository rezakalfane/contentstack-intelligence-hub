import { SEVERITY_WEIGHT } from "./rules";
import type { CoverageCell, LocalizationDiagnostic, TranslatableUnit } from "./types";

const isEligible = (u: TranslatableUnit) => u.completeness !== "not_applicable";

/** eligible = source translatable fields in scope; complete = explicit, non-empty, valid localized value. */
export function coverage(units: TranslatableUnit[]): CoverageCell {
  const eligible = units.filter(isEligible);
  const complete = eligible.filter((u) => u.completeness === "complete").length;
  return {
    eligible: eligible.length,
    complete,
    percent: eligible.length === 0 ? null : Math.round((100 * complete) / eligible.length),
  };
}

export function coverageBy(units: TranslatableUnit[], pick: (u: TranslatableUnit) => string): Map<string, CoverageCell> {
  const groups = new Map<string, TranslatableUnit[]>();
  for (const u of units) {
    const k = pick(u);
    groups.set(k, [...(groups.get(k) ?? []), u]);
  }
  return new Map([...groups].map(([k, v]) => [k, coverage(v)]));
}

export function weightedFindings(open: LocalizationDiagnostic[]): number {
  return open.reduce((n, d) => n + SEVERITY_WEIGHT[d.severity], 0);
}

/** healthScore = round(100 * max(0, 1 - weighted / (5 * eligibleUnits))). Heuristic, not a validated grade. */
export function healthScore(open: LocalizationDiagnostic[], eligibleUnits: number): number | null {
  if (eligibleUnits === 0) return null;
  return Math.round(100 * Math.max(0, 1 - weightedFindings(open) / (5 * eligibleUnits)));
}

export function acceptanceRate(approved: number, rejected: number): number | null {
  return approved + rejected === 0 ? null : approved / (approved + rejected);
}
