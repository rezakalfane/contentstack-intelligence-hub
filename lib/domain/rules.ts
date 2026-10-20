import { fingerprint, shortId } from "./fingerprint";
import { diffTokens } from "./placeholders";
import type {
  EntryLocaleState,
  FieldCompleteness,
  IssueStatus,
  LocaleInfo,
  LocalizationDiagnostic,
  LocalizationExistence,
  Severity,
  TranslatableUnit,
} from "./types";
import type { NormalizedContentType, NormalizedEntry, Publication } from "./types";
import { extractLeaves, indexLeaves, matchLeaf } from "./normalizer";
import { normalizeText } from "./fingerprint";

export const RULES = {
  "LOC-001": { title: "Missing translation", logic: "Expected translatable field has no explicit localized value (entry not localized, or field empty/absent in the localized version)", fix: "Generate a proposal, review, then update the localized entry" },
  "LOC-002": { title: "Incomplete or possibly untranslated field", logic: "Localized value is identical to the source (≥4 words) or a rich-text target has fewer blocks than the source", fix: "Review the field; translate or confirm it is intentionally unchanged" },
  "LOC-003": { title: "Possibly stale translation", logic: "Source fingerprint differs from the fingerprint approved with the last reviewed translation (needs an approval baseline)", fix: "Compare the updated source and re-review" },
  "LOC-004": { title: "Placeholder / markup mismatch", logic: "Tokens such as {{name}}, %s, links or HTML tags differ between source and target", fix: "Restore the original tokens in the target" },
  "PUB-001": { title: "Unpublished localized variant", logic: "Localized version exists, source is published to the selected environment, target is not", fix: "Use the existing Contentstack publishing workflow (this tool never publishes)" },
} as const;
export type RuleId = keyof typeof RULES;

export const SEVERITY_WEIGHT: Record<Severity, number> = { critical: 5, high: 3, medium: 2, low: 1 };
const SEVERITY_FACTOR: Record<Severity, number> = { critical: 8, high: 4, medium: 2, low: 1 };
const HEADLINE_FIELD = /(^|[._›\s])(title|headline|hero|cta|seo|meta|tagline|message|label)([._›\s\[]|$)/i;

export interface AnalysisInput {
  stackId: string;
  branch?: string;
  masterLocale: string;
  locales: LocaleInfo[];
  contentTypes: NormalizedContentType[];
  sourceEntries: NormalizedEntry[];
  /** `${ct}/${entryUid}` -> locale -> explicitly localized? (undefined locale = presence unknown) */
  presence: Map<string, Map<string, boolean>>;
  /** `${ct}/${entryUid}/${locale}` -> explicit localized entry */
  targets: Map<string, NormalizedEntry>;
  environmentUid?: string;
  /** unit key -> source fingerprint approved with the last reviewed translation */
  baselines: Map<string, string>;
}

function pub(entry: NormalizedEntry | undefined, env?: string): Publication {
  if (!entry || !env || !entry.publicationKnown) return "unknown";
  return entry.publishedEnvironments?.includes(env) ? "published" : "unpublished";
}

export function unitKey(ct: string, entryUid: string, locale: string, path: string): string {
  return `${ct}/${entryUid}/${locale}/${path}`;
}

export function buildUnits(input: AnalysisInput): { units: TranslatableUnit[]; entryLocales: EntryLocaleState[] } {
  const units: TranslatableUnit[] = [];
  const entryLocales: EntryLocaleState[] = [];
  const ctByUid = new Map(input.contentTypes.map((c) => [c.uid, c]));
  const targetLocales = input.locales.filter((l) => l.code !== input.masterLocale);

  for (const source of input.sourceEntries) {
    const ct = ctByUid.get(source.contentTypeUid);
    if (!ct) continue;
    const sourceLeaves = extractLeaves(ct.schema, source.values).filter((l) => !l.nonLocalizable && l.text.trim() !== "");
    const sourcePublished = pub(source, input.environmentUid);

    for (const loc of targetLocales) {
      const presenceMap = input.presence.get(`${ct.uid}/${source.uid}`);
      const localized = presenceMap?.get(loc.code);
      const existence: LocalizationExistence =
        localized === undefined ? "unknown" : localized ? "exists" : loc.fallbackLocale ? "fallback_only" : "not_localized";
      const target = existence === "exists" ? input.targets.get(`${ct.uid}/${source.uid}/${loc.code}`) : undefined;

      entryLocales.push({
        key: `${ct.uid}/${source.uid}/${loc.code}`,
        contentTypeUid: ct.uid,
        contentTypeTitle: ct.title,
        entryUid: source.uid,
        title: source.title,
        locale: loc.code,
        existence,
        publication: existence === "exists" ? pub(target, input.environmentUid) : "unknown",
        sourcePublished,
        sourceVersion: source.version,
        targetVersion: target?.version,
        campaignId: source.campaign?.id,
        campaignLaunchDate: source.campaign?.launchDate,
      });

      // Presence unknown (scan failure) or target unreadable: do not invent completeness.
      if (existence === "unknown" || (existence === "exists" && !target)) continue;

      const targetIndex = indexLeaves(target ? extractLeaves(ct.schema, target.values) : []);

      for (const leaf of sourceLeaves) {
        const key = unitKey(ct.uid, source.uid, loc.code, leaf.path);
        const sourceFp = fingerprint(leaf.text);
        const { leaf: t, byPosition } = matchLeaf(targetIndex, leaf);
        const targetText = t?.text;
        const evidence: string[] = [];
        if (byPosition) evidence.push("Matched to the localized instance by position (instance IDs differ between locales).");
        let completeness: FieldCompleteness;

        if (existence !== "exists") {
          completeness = "missing";
          evidence.push(
            existence === "fallback_only"
              ? `No explicit ${loc.code} version; delivery would fall back to ${loc.fallbackLocale}. Fallback is not counted as localized.`
              : `No explicit ${loc.code} version of this entry.`,
          );
        } else if (!targetText || targetText.trim() === "") {
          completeness = "missing";
          evidence.push(t ? "Field exists but is empty/whitespace in the localized version." : "Field is absent in the localized version.");
        } else {
          completeness = "complete";
          const sameAsSource =
            normalizeText(targetText) === normalizeText(leaf.text) && normalizeText(leaf.text).split(" ").length >= 4;
          if (sameAsSource) {
            completeness = "incomplete";
            evidence.push("Localized value is identical to the source text (possibly untranslated).");
          }
          if (leaf.kind === "richtext") {
            const sb = leaf.text.split("\n").length;
            const tb = targetText.split("\n").length;
            if (tb < sb) {
              completeness = "incomplete";
              evidence.push(`Rich text has ${tb} block(s) in ${loc.code} vs ${sb} in the source.`);
            }
          }
          const diff = diffTokens(leaf.text, targetText);
          if (diff.missing.length || diff.unexpected.length) {
            completeness = "incomplete";
            evidence.push(
              `Token mismatch — missing: ${diff.missing.join(", ") || "none"}; unexpected: ${diff.unexpected.join(", ") || "none"}.`,
            );
          }
        }

        const baseline = input.baselines.get(key);
        const freshness = baseline === undefined ? "unknown" : baseline === sourceFp ? "current" : "stale";
        if (freshness === "stale") evidence.push("Source changed since the translation was last approved in this tool.");

        units.push({
          key,
          pointer: { stackId: input.stackId, branch: input.branch, contentTypeUid: ct.uid, entryUid: source.uid, locale: loc.code, fieldPath: leaf.path },
          entryTitle: source.title,
          contentTypeTitle: ct.title,
          fieldLabel: leaf.label,
          kind: leaf.kind,
          mandatory: leaf.mandatory,
          sourceText: leaf.text,
          sourceFingerprint: sourceFp,
          targetText: targetText && targetText.trim() ? targetText : undefined,
          existence,
          completeness,
          freshness,
          publication: existence === "exists" ? pub(target, input.environmentUid) : "unknown",
          sourceUpdatedAt: source.updatedAt,
          sourceVersion: source.version,
          targetVersion: target?.version,
          approvedSourceFingerprint: baseline,
          campaignId: source.campaign?.id,
          evidence,
        });
      }
    }
  }
  return { units, entryLocales };
}

// ---------- Diagnostics ----------

export interface PolicyInput {
  criticalLocales: string[];
  now: Date;
  deadlineDays?: number;
}

function missingSeverity(u: TranslatableUnit): Severity {
  if (u.mandatory) return "critical";
  return HEADLINE_FIELD.test(u.pointer.fieldPath) ? "high" : "medium";
}

function priorityOf(
  severity: Severity,
  locale: string,
  sourcePublished: Publication,
  launchDate: string | undefined,
  policy: PolicyInput,
): { value: number; rationale: string[] } {
  const rationale = [`severity ${severity} ×${SEVERITY_FACTOR[severity]}`];
  let value = SEVERITY_FACTOR[severity];
  if (policy.criticalLocales.includes(locale)) {
    value *= 1.5;
    rationale.push(`critical market ${locale} ×1.5`);
  }
  if (sourcePublished === "published") {
    value *= 1.3;
    rationale.push("source is published to the selected environment ×1.3");
  }
  if (launchDate) {
    const days = (new Date(launchDate).getTime() - policy.now.getTime()) / 86_400_000;
    if (days >= 0 && days <= (policy.deadlineDays ?? 14)) {
      value *= 1.5;
      rationale.push(`campaign launches in ${Math.ceil(days)} day(s) ×1.5`);
    }
  }
  return { value: Math.round(value * 10) / 10, rationale };
}

export function deriveDiagnostics(
  units: TranslatableUnit[],
  entryLocales: EntryLocaleState[],
  policy: PolicyInput,
): LocalizationDiagnostic[] {
  const elByKey = new Map(entryLocales.map((e) => [e.key, e]));
  const out: LocalizationDiagnostic[] = [];

  for (const u of units) {
    const ruleIds: RuleId[] = [];
    let severity: Severity = "low";
    let status: IssueStatus | undefined;

    if (u.completeness === "missing") {
      ruleIds.push("LOC-001");
      severity = missingSeverity(u);
      status = "missing";
    }
    if (u.completeness === "incomplete") {
      ruleIds.push("LOC-002");
      severity = u.mandatory ? "high" : "medium";
      status = "incomplete";
      if (u.evidence.some((e) => e.startsWith("Token mismatch"))) {
        ruleIds.push("LOC-004");
        severity = "high";
      }
    }
    if (u.freshness === "stale") {
      if (!ruleIds.length) {
        severity = "medium";
        status = "stale";
      }
      ruleIds.push("LOC-003");
    }
    if (!ruleIds.length) continue;

    const el = elByKey.get(`${u.pointer.contentTypeUid}/${u.pointer.entryUid}/${u.pointer.locale}`);
    const pr = priorityOf(severity, u.pointer.locale, el?.sourcePublished ?? "unknown", el?.campaignLaunchDate, policy);
    out.push({
      id: shortId("d", u.key),
      unitKey: u.key,
      pointer: u.pointer,
      title: u.entryTitle,
      contentTypeTitle: u.contentTypeTitle,
      fieldLabel: u.fieldLabel,
      campaignId: u.campaignId,
      existence: u.existence,
      completeness: u.completeness,
      freshness: u.freshness,
      publication: u.publication,
      severity,
      proposable: true,
      ruleIds,
      evidence: u.evidence,
      sourceText: u.sourceText,
      existingText: u.targetText,
      sourceFingerprint: u.sourceFingerprint,
      cmsVersion: u.targetVersion,
      priority: pr.value,
      priorityRationale: pr.rationale,
      status: status ?? "stale",
    });
  }

  for (const el of entryLocales) {
    if (el.existence === "exists" && el.sourcePublished === "published" && el.publication === "unpublished") {
      const key = `${el.contentTypeUid}/${el.entryUid}/${el.locale}/(entry)`;
      const pr = priorityOf("medium", el.locale, el.sourcePublished, el.campaignLaunchDate, policy);
      out.push({
        id: shortId("d", key),
        unitKey: key,
        pointer: { stackId: "", contentTypeUid: el.contentTypeUid, entryUid: el.entryUid, locale: el.locale, fieldPath: "(entry)" },
        title: el.title,
        contentTypeTitle: el.contentTypeTitle,
        fieldLabel: "Whole entry (publication)",
        campaignId: el.campaignId,
        existence: el.existence,
        completeness: "not_applicable",
        freshness: "unknown",
        publication: el.publication,
        severity: "medium",
        proposable: false,
        ruleIds: ["PUB-001"],
        evidence: [`Localized ${el.locale} version exists but is not published to the selected environment; the source is.`],
        sourceText: "",
        sourceFingerprint: "",
        cmsVersion: el.targetVersion,
        priority: pr.value,
        priorityRationale: pr.rationale,
        status: "unpublished",
      });
    }
  }

  const sevOrder: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return out.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity] || b.priority - a.priority || a.title.localeCompare(b.title));
}
