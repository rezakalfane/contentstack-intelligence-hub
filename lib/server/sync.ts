import "server-only";
import { CmaClient } from "@/lib/adapters/cma-client";
import { createLiveAdapter } from "@/lib/adapters/live-adapter";
import type { ScanProgress } from "@/lib/domain/types";
import { runScan, errMsg } from "@/lib/scan/scan";
import { buildView } from "@/lib/scan/view";
import { ScanAbortedError } from "@/lib/utils/pool";
import { criticalLocales, getEnv, resolveCmaBase } from "@/lib/security/env";
import { store } from "@/lib/store/store";
import { approvedBaselines, LIVE_PROVENANCE } from "./data";

interface Job {
  progress: ScanProgress;
  controller: AbortController;
}
const g = globalThis as unknown as { __scanJob?: Job };

const idle = (): ScanProgress => ({ state: "idle", phase: "Idle", done: 0, total: 0, errors: [] });

export function getProgress(): ScanProgress {
  return g.__scanJob?.progress ?? idle();
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

export function startLiveScan(): { started: true } | { started: false; reason: string } {
  if (g.__scanJob?.progress.state === "running") return { started: false, reason: "A scan is already running" };
  const made = makeLiveClient();
  if ("error" in made) return { started: false, reason: made.error };
  const env = getEnv();
  const controller = new AbortController();
  const job: Job = { progress: { state: "running", phase: "Starting", done: 0, total: 0, startedAt: new Date().toISOString(), errors: [] }, controller };
  g.__scanJob = job;

  const adapter = createLiveAdapter({
    client: made.client, region: made.region, branch: env.CONTENTSTACK_BRANCH, masterLocale: env.CONTENTSTACK_MASTER_LOCALE, environment: env.CONTENTSTACK_ENVIRONMENT,
  });

  void runScan(adapter, {
    signal: controller.signal,
    onProgress: (p) => {
      job.progress = { ...p };
    },
    baselines: approvedBaselines("live"),
    maxEntriesPerType: env.SCAN_MAX_ENTRIES_PER_TYPE,
    concurrency: 3,
    criticalLocales: criticalLocales(env, []),
    provenance: LIVE_PROVENANCE,
  })
    .then((snapshot) => {
      const kpis = buildView(snapshot, [], new Date()).kpis;
      store.update("live", (d) => {
        d.snapshot = snapshot;
        d.history = [...(d.history ?? []), { at: snapshot.completedAt, coverage: kpis.overall.percent, health: kpis.health, open: kpis.openIssues }].slice(-30);
      });
      job.progress = {
        ...job.progress, state: snapshot.status === "complete" ? "complete" : "partial", phase: "Done", percent: 100, finishedAt: snapshot.completedAt,
        errors: snapshot.errors, message: `${made.client.callCount} Contentstack API calls`,
      };
    })
    .catch((err) => {
      job.progress = {
        ...job.progress,
        state: err instanceof ScanAbortedError ? "cancelled" : "failed",
        phase: err instanceof ScanAbortedError ? "Cancelled — previous snapshot kept" : "Failed",
        finishedAt: new Date().toISOString(),
        message: errMsg(err),
      };
    });
  return { started: true };
}

export function cancelLiveScan(): boolean {
  const job = g.__scanJob;
  if (job?.progress.state !== "running") return false;
  job.controller.abort();
  return true;
}
