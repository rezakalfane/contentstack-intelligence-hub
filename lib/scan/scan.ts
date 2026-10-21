import type { ContentstackAdapter } from "@/lib/adapters/contentstack-adapter";
import { buildGraph } from "@/lib/domain/graph";
import { computeFieldUsage } from "@/lib/domain/schema-governance";
import { extractSeoFacts } from "@/lib/domain/seo";
import { buildUnits } from "@/lib/domain/rules";
import { EXCLUSION_POLICY_NOTE } from "@/lib/domain/normalizer";
import type { NormalizedEntry, ScanError, ScanProgress, Snapshot } from "@/lib/domain/types";
import { mapPool, ScanAbortedError } from "@/lib/utils/pool";

export interface ScanOptions {
  signal?: AbortSignal;
  onProgress?: (p: ScanProgress) => void;
  /** Approval baselines recorded by this tool (unit key -> fingerprint). */
  baselines: Map<string, string>;
  maxEntriesPerType: number;
  concurrency: number;
  criticalLocales: string[];
  provenance: string;
  now?: () => Date;
}

const MAX_PAGES = 200;

export async function runScan(adapter: ContentstackAdapter, opts: ScanOptions): Promise<Snapshot> {
  const now = opts.now ?? (() => new Date());
  const startedAt = now().toISOString();
  const errors: ScanError[] = [];
  const limits: string[] = [];
  const progress: ScanProgress = { state: "running", phase: "Connecting", done: 0, total: 0, startedAt, errors };
  const emit = (patch: Partial<ScanProgress>) => opts.onProgress?.(Object.assign(progress, patch));
  const check = () => {
    if (opts.signal?.aborted) throw new ScanAbortedError();
  };

  emit({ phase: "Reading stack context", percent: 2 });
  const ctx = await adapter.getContext();
  check();

  emit({ phase: "Reading content types", percent: 6 });
  const allTypes = await adapter.listContentTypes();
  check();

  // Source entries (master locale), bounded + paginated.
  emit({ phase: "Listing source entries", percent: 10 });
  const sourceEntries: NormalizedEntry[] = [];
  const counts = new Map<string, number>();
  const truncatedTypes = new Set<string>();
  const failedTypes = new Set<string>();
  for (const ct of allTypes) {
    let cursor: string | undefined;
    let n = 0;
    try {
      for (let page = 0; page < MAX_PAGES; page++) {
        check();
        const res = await adapter.listSourceEntries({ contentTypeUid: ct.uid, cursor });
        for (const e of res.items) {
          if (n >= opts.maxEntriesPerType) break;
          sourceEntries.push(e);
          n++;
        }
        if (n >= opts.maxEntriesPerType && (res.cursor || (res.total ?? 0) > n)) {
          truncatedTypes.add(ct.uid);
          limits.push(`${ct.title}: first ${opts.maxEntriesPerType} of ${res.total ?? "more"} entries scanned (SCAN_MAX_ENTRIES_PER_TYPE).`);
          break;
        }
        cursor = res.cursor;
        if (!cursor) break;
      }
    } catch (err) {
      if (err instanceof ScanAbortedError) throw err;
      failedTypes.add(ct.uid);
      errors.push({ scope: `content type ${ct.uid}`, message: errMsg(err) });
    }
    counts.set(ct.uid, n);
  }

  // Locale presence + localized entries, one explicit /locales call per source entry.
  const targetLocales = ctx.locales.filter((l) => l.code !== ctx.masterLocale);
  const presence = new Map<string, Map<string, boolean>>();
  const targets = new Map<string, NormalizedEntry>();
  emit({ phase: "Checking explicit locale versions", done: 0, total: sourceEntries.length, percent: 20 });
  let done = 0;
  await mapPool(sourceEntries, opts.concurrency, async (entry) => {
    const id = `${entry.contentTypeUid}/${entry.uid}`;
    try {
      const localizedCodes = new Set(await adapter.getLocalePresence({ contentTypeUid: entry.contentTypeUid, entryUid: entry.uid }));
      const map = new Map<string, boolean>();
      for (const l of targetLocales) map.set(l.code, localizedCodes.has(l.code));
      presence.set(id, map);
      for (const l of targetLocales) {
        if (!localizedCodes.has(l.code)) continue;
        try {
          const t = await adapter.getLocalizedEntry({
            stackId: ctx.stack, branch: ctx.branch, contentTypeUid: entry.contentTypeUid, entryUid: entry.uid, locale: l.code, fieldPath: "",
          });
          if (t) targets.set(`${id}/${l.code}`, t);
          else errors.push({ scope: `${id} (${l.code})`, message: "Localized version reported by /locales but could not be read" });
        } catch (err) {
          if (err instanceof ScanAbortedError) throw err;
          errors.push({ scope: `${id} (${l.code})`, message: errMsg(err) });
        }
      }
    } catch (err) {
      if (err instanceof ScanAbortedError) throw err;
      errors.push({ scope: `${id} locales`, message: errMsg(err) });
    }
    emit({ done: ++done, percent: 20 + Math.round((75 * done) / Math.max(1, sourceEntries.length)) });
  }, opts.signal);

  emit({ phase: "Analysing fields", percent: 96 });
  const baselines = new Map([...(adapter.getApprovalBaselines?.() ?? []), ...opts.baselines]);
  const { units, entryLocales } = buildUnits({
    stackId: ctx.stack, branch: ctx.branch, masterLocale: ctx.masterLocale, locales: ctx.locales, contentTypes: allTypes,
    sourceEntries, presence, targets, environmentUid: ctx.environmentUid, baselines,
  });

  const completeTypes = new Set(allTypes.map((c) => c.uid).filter((u) => !truncatedTypes.has(u) && !failedTypes.has(u)));
  const graph = buildGraph({ contentTypes: allTypes, entries: sourceEntries, completeTypes });
  graph.note = `References are read from ${ctx.masterLocale} entries (reference fields, JSON RTE embeds, file fields).${truncatedTypes.size || failedTypes.size ? " Some content types were not fully scanned; their targets are shown as unverified rather than broken." : ""}`;

  const ctByUid = new Map(allTypes.map((c) => [c.uid, c]));
  const seo = sourceEntries.flatMap((e) => {
    const ct = ctByUid.get(e.contentTypeUid);
    return ct ? [extractSeoFacts(ct, e)] : [];
  });

  const unknown = entryLocales.filter((e) => e.existence === "unknown").length;
  if (unknown) errors.push({ scope: "coverage", message: `${unknown} entry×locale combination(s) have unknown localization state and are excluded from coverage.` });

  return {
    mode: adapter.kind,
    provenance: opts.provenance,
    stack: ctx.stack, region: ctx.region, branch: ctx.branch, masterLocale: ctx.masterLocale, locales: ctx.locales,
    contentTypes: allTypes.map((c) => ({ uid: c.uid, title: c.title, entries: counts.get(c.uid) ?? 0 })),
    sourceEntryCount: sourceEntries.length,
    environment: ctx.environmentName,
    startedAt, completedAt: now().toISOString(),
    status: errors.length ? "partial" : "complete",
    errors, limits, units, entryLocales, graph, seo, schemas: allTypes, fieldUsage: computeFieldUsage(allTypes, sourceEntries),
    policy: { criticalLocales: opts.criticalLocales, exclusions: EXCLUSION_POLICY_NOTE },
  };
}

export function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : "Unknown error";
}
