import "server-only";
import { after } from "next/server";
import { CmaClient } from "@/lib/adapters/cma-client";
import { createLiveAdapter } from "@/lib/adapters/live-adapter";
import type { ScanProgress } from "@/lib/domain/types";
import { runScan, errMsg } from "@/lib/scan/scan";
import { buildView } from "@/lib/scan/view";
import { ScanAbortedError } from "@/lib/utils/pool";
import { criticalLocales, getEnv, resolveCmaBase } from "@/lib/security/env";
import { readDoc, store, writeDoc } from "@/lib/store/store";
import { approvedBaselines, LIVE_PROVENANCE } from "./data";

/**
 * Scan progress is a shared document, not process memory: on Vercel the POST that starts the scan,
 * the polling GETs, a cancel and the page render can each land on a different instance.
 */
const PROGRESS = "scan-progress";
const CANCEL = "scan-cancel";
/** How often a running scan publishes progress and checks for a cancel request. */
const FLUSH_MS = 1500;
/** A "running" record older than this is a scan whose instance died (max function duration is 300 s). */
const STALE_MS = 6 * 60_000;

const idle = (): ScanProgress => ({ state: "idle", phase: "Idle", done: 0, total: 0, errors: [] });

const isLive = (p: ScanProgress | null): boolean =>
  p?.state === "running" && Date.now() - Date.parse(p.startedAt ?? "") < STALE_MS;

export async function getProgress(): Promise<ScanProgress> {
  const p = await readDoc<ScanProgress>(PROGRESS);
  if (!p) return idle();
  if (p.state === "running" && !isLive(p)) return { ...p, state: "failed", phase: "Failed", message: "The scan stopped without finishing (function timeout or restart). Run it again." };
  return p;
}

export function makeLiveClient(token?: string): { client: CmaClient; region: string } | { error: string } {
  const env = getEnv();
  const base = resolveCmaBase(env);
  if ("error" in base) return { error: base.error };
  const t = token ?? env.CONTENTSTACK_MANAGEMENT_TOKEN;
  if (!env.CONTENTSTACK_API_KEY || !t) return { error: "CONTENTSTACK_API_KEY and CONTENTSTACK_MANAGEMENT_TOKEN are required in .env.local" };
  return {
    client: new CmaClient({ base: base.base, apiKey: env.CONTENTSTACK_API_KEY, token: t, branch: env.CONTENTSTACK_BRANCH }),
    region: base.region,
  };
}

export async function startLiveScan(): Promise<{ started: true; progress: ScanProgress } | { started: false; reason: string }> {
  if (isLive(await readDoc<ScanProgress>(PROGRESS))) return { started: false, reason: "A scan is already running" };
  const made = makeLiveClient();
  if ("error" in made) return { started: false, reason: made.error };
  const env = getEnv();
  const controller = new AbortController();
  let progress: ScanProgress = { state: "running", phase: "Starting", done: 0, total: 0, startedAt: new Date().toISOString(), errors: [] };
  await writeDoc(CANCEL, { requested: false });
  await writeDoc(PROGRESS, progress);
  const baselines = approvedBaselines(await store.read("live"));

  const adapter = createLiveAdapter({
    client: made.client, region: made.region, branch: env.CONTENTSTACK_BRANCH, masterLocale: env.CONTENTSTACK_MASTER_LOCALE, environment: env.CONTENTSTACK_ENVIRONMENT,
  });

  // Publish progress periodically (not on every entry) and pick up cancel requests from any instance.
  let flushing: Promise<void> = Promise.resolve();
  const flush = () => {
    flushing = flushing.then(async () => {
      if (progress.state !== "running") return;
      await writeDoc(PROGRESS, progress).catch(() => undefined);
      const c = await readDoc<{ requested: boolean }>(CANCEL).catch(() => null);
      if (c?.requested) controller.abort();
    });
  };
  const timer = setInterval(flush, FLUSH_MS);

  // after(): Vercel keeps the function alive until the scan settles instead of freezing it once the 202 is sent.
  after(async () => {
    try {
      const snapshot = await runScan(adapter, {
        signal: controller.signal,
        onProgress: (p) => {
          progress = { ...p };
        },
        baselines,
        maxEntriesPerType: env.SCAN_MAX_ENTRIES_PER_TYPE,
        concurrency: 3,
        criticalLocales: criticalLocales(env, []),
        provenance: LIVE_PROVENANCE,
      });
      const kpis = buildView(snapshot, [], new Date()).kpis;
      // Save the snapshot BEFORE reporting completion: the client refreshes the page as soon as it sees "complete".
      await store.update("live", (d) => {
        d.snapshot = snapshot;
        d.history = [...(d.history ?? []), { at: snapshot.completedAt, coverage: kpis.overall.percent, health: kpis.health, open: kpis.openIssues }].slice(-30);
      });
      progress = {
        ...progress, state: snapshot.status === "complete" ? "complete" : "partial", phase: "Done", percent: 100, finishedAt: snapshot.completedAt,
        errors: snapshot.errors, message: `${made.client.callCount} Contentstack API calls`,
      };
    } catch (err) {
      progress = {
        ...progress,
        state: err instanceof ScanAbortedError ? "cancelled" : "failed",
        phase: err instanceof ScanAbortedError ? "Cancelled — previous snapshot kept" : "Failed",
        finishedAt: new Date().toISOString(),
        message: errMsg(err),
      };
    } finally {
      clearInterval(timer);
      await flushing;
      await writeDoc(PROGRESS, progress);
    }
  });
  return { started: true, progress };
}

export async function cancelLiveScan(): Promise<boolean> {
  if (!isLive(await readDoc<ScanProgress>(PROGRESS))) return false;
  await writeDoc(CANCEL, { requested: true });
  return true;
}
