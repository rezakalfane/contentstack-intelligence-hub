import "server-only";
import { z } from "zod";
import { APP_HOSTS, type LinkBase } from "@/lib/domain/cs-links";

// Region -> CMA host. Only these hosts are ever called: arbitrary URLs from the browser or env are rejected.
export const CMA_HOSTS: Record<string, string> = {
  na: "https://api.contentstack.io",
  eu: "https://eu-api.contentstack.com",
  au: "https://au-api.contentstack.com",
  "azure-na": "https://azure-na-api.contentstack.com",
  "azure-eu": "https://azure-eu-api.contentstack.com",
  "gcp-na": "https://gcp-na-api.contentstack.com",
  "gcp-eu": "https://gcp-eu-api.contentstack.com",
};

export const REASONING_EFFORTS = ["none", "minimal", "low", "medium", "high", "xhigh"] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const str = z.preprocess(blank, z.string().optional());
const bool = z.preprocess((v) => (typeof v === "string" ? v.trim().toLowerCase() === "true" : v), z.boolean().default(false));
const num = z.preprocess((v) => (blank(v) === undefined ? undefined : Number(v)), z.number().positive().optional());

const EnvSchema = z.object({
  DATA_MODE: z.preprocess(blank, z.enum(["live", "demo"]).default("demo")),
  CONTENTSTACK_API_BASE_URL: str,
  CONTENTSTACK_REGION: str,
  CONTENTSTACK_API_KEY: str,
  CONTENTSTACK_MANAGEMENT_TOKEN: str,
  CONTENTSTACK_BRANCH: z.preprocess(blank, z.string().default("main")),
  CONTENTSTACK_MASTER_LOCALE: str,
  CONTENTSTACK_ENVIRONMENT: str,
  CONTENTSTACK_WRITE_TOKEN: str,
  ENABLE_CMS_WRITES: bool,
  ENABLE_CMS_PUBLISH: bool,
  /** Comma-separated entry UIDs the writer may touch (a safe test entry). Empty = nothing writable. */
  CMS_WRITE_ALLOWED_ENTRY_UIDS: str,
  OPENAI_API_KEY: str,
  OPENAI_MODEL: z.preprocess(blank, z.string().default("gpt-6-luna")),
  OPENAI_REASONING_EFFORT: z.preprocess(blank, z.enum(REASONING_EFFORTS).optional()),
  OPENAI_PRICE_INPUT_PER_MTOK: num,
  OPENAI_PRICE_OUTPUT_PER_MTOK: num,
  AI_MAX_USD_PER_BATCH: z.preprocess((v) => (blank(v) === undefined ? 2 : Number(v)), z.number().positive()),
  AI_SEND_CONTENT_TO_OPENAI: bool,
  SCAN_MAX_ENTRIES_PER_TYPE: z.preprocess((v) => (blank(v) === undefined ? 200 : Number(v)), z.number().int().positive().max(2000)),
  CRITICAL_LOCALES: str,
  HUB_ACTOR_ID: z.preprocess(blank, z.string().default("reviewer@local")),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // Names of invalid keys only; never echo values.
    const keys = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid environment configuration: ${keys}`);
  }
  cached = parsed.data;
  return cached;
}

export function resolveCmaBase(env: Env): { base: string; region: string } | { error: string } {
  if (env.CONTENTSTACK_API_BASE_URL) {
    const url = env.CONTENTSTACK_API_BASE_URL.replace(/\/+$/, "");
    const hit = Object.entries(CMA_HOSTS).find(([, h]) => h === url);
    if (!hit) return { error: `CONTENTSTACK_API_BASE_URL is not an allowlisted Contentstack CMA host. Allowed: ${Object.values(CMA_HOSTS).join(", ")}` };
    return { base: url, region: hit[0] };
  }
  const region = (env.CONTENTSTACK_REGION ?? "na").toLowerCase();
  const host = CMA_HOSTS[region];
  if (!host) return { error: `Unknown CONTENTSTACK_REGION "${region}". Allowed: ${Object.keys(CMA_HOSTS).join(", ")}` };
  return { base: host, region };
}

export function contentstackLinkBase(env: Env): LinkBase | null {
  const base = resolveCmaBase(env);
  const host = "region" in base ? APP_HOSTS[base.region] : undefined;
  if (!host || !env.CONTENTSTACK_API_KEY) return null;
  return { host, stackKey: env.CONTENTSTACK_API_KEY, branch: env.CONTENTSTACK_BRANCH };
}

export function criticalLocales(env: Env, fallback: string[]): string[] {
  return env.CRITICAL_LOCALES ? env.CRITICAL_LOCALES.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) : fallback;
}

/** Booleans/labels only — safe to serialize to the browser. */
export function publicIntegrationStatus(env: Env) {
  const base = resolveCmaBase(env);
  return {
    dataModeDefault: env.DATA_MODE,
    contentstack: {
      configured: Boolean(env.CONTENTSTACK_API_KEY && env.CONTENTSTACK_MANAGEMENT_TOKEN),
      region: "region" in base ? base.region : null,
      branch: env.CONTENTSTACK_BRANCH,
      environment: env.CONTENTSTACK_ENVIRONMENT ?? null,
      configError: "error" in base ? base.error : null,
    },
    openai: {
      configured: Boolean(env.OPENAI_API_KEY),
      model: env.OPENAI_MODEL,
      reasoningEffort: env.OPENAI_REASONING_EFFORT ?? null,
      contentTransferAllowed: env.AI_SEND_CONTENT_TO_OPENAI,
      priced: Boolean(env.OPENAI_PRICE_INPUT_PER_MTOK && env.OPENAI_PRICE_OUTPUT_PER_MTOK),
    },
    writes: {
      enabled: env.ENABLE_CMS_WRITES,
      publishEnabled: false,
      writeTokenConfigured: Boolean(env.CONTENTSTACK_WRITE_TOKEN),
      // Entry UIDs are identifiers, not secrets.
      allowedEntryUids: (env.CMS_WRITE_ALLOWED_ENTRY_UIDS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    },
  };
}
