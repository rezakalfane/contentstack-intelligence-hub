import "server-only";
import { cookies } from "next/headers";
import { createDemoAdapter } from "@/lib/adapters/demo-adapter";
import { DEMO_CRITICAL_LOCALES } from "@/lib/demo/fixtures";
import type { DataMode, Snapshot } from "@/lib/domain/types";
import { buildView, type View } from "@/lib/scan/view";
import { buildSeoView, type SeoView } from "@/lib/scan/seo-view";
import { runScan } from "@/lib/scan/scan";
import { getEnv, resolveCmaBase } from "@/lib/security/env";
import { store, type StoreData } from "@/lib/store/store";

export const MODE_COOKIE = "hub_mode";
export const DEMO_PROVENANCE = "DEMO · Sample fixtures";
export const LIVE_PROVENANCE = "LIVE · Contentstack";

export function liveConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.CONTENTSTACK_API_KEY && env.CONTENTSTACK_MANAGEMENT_TOKEN) && "base" in resolveCmaBase(env);
}

export async function resolveMode(): Promise<DataMode> {
  const c = (await cookies()).get(MODE_COOKIE)?.value;
  if (c === "demo") return "demo";
  if (c === "live") return "live";
  return getEnv().DATA_MODE === "live" && liveConfigured() ? "live" : "demo";
}

const g = globalThis as unknown as { __demoSnapshot?: Promise<Snapshot> };

export function getDemoSnapshot(): Promise<Snapshot> {
  g.__demoSnapshot ??= runScan(createDemoAdapter(), {
    baselines: new Map(), maxEntriesPerType: 1000, concurrency: 8, criticalLocales: DEMO_CRITICAL_LOCALES, provenance: DEMO_PROVENANCE,
    now: () => new Date(),
  });
  return g.__demoSnapshot;
}

/** Baselines recorded when a reviewer approved a proposal: unit key -> approved source fingerprint. */
export function approvedBaselines(data: StoreData): Map<string, string> {
  const out = new Map<string, string>();
  for (const p of Object.values(data.proposals)) {
    if (["approved", "write_pending", "written"].includes(p.status)) out.set(p.unitKey, p.sourceFingerprint);
  }
  return out;
}

export async function getView(mode: DataMode, data?: StoreData): Promise<View | null> {
  data ??= await store.read(mode);
  const snapshot = mode === "demo" ? await getDemoSnapshot() : data.snapshot;
  if (!snapshot) return null;
  return buildView(snapshot, Object.values(data.proposals), new Date());
}

export async function getSeoView(mode: DataMode): Promise<SeoView | null> {
  const data = await store.read(mode);
  const snapshot = mode === "demo" ? await getDemoSnapshot() : data.snapshot;
  if (!snapshot) return null;
  return buildSeoView(snapshot, Object.values(data.proposals), new Date());
}

export async function getSnapshot(mode: DataMode): Promise<Snapshot | null> {
  return mode === "demo" ? getDemoSnapshot() : (await store.read("live")).snapshot ?? null;
}
