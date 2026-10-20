import type { Env } from "./env";

export type WriteDecision = { allowed: true } | { allowed: false; code: "writes_disabled" | "forbidden"; reason: string };

/** Live CMS writes are off unless every condition holds. Publishing is never available. */
export function evaluateWritePolicy(
  env: Pick<Env, "ENABLE_CMS_WRITES" | "CONTENTSTACK_WRITE_TOKEN" | "CMS_WRITE_ALLOWED_ENTRY_UIDS">,
  mode: "live" | "demo",
  target: { entryUid: string },
  confirm: boolean,
): WriteDecision {
  if (mode !== "live") return { allowed: false, code: "writes_disabled", reason: "Demo mode never writes to Contentstack" };
  if (!env.ENABLE_CMS_WRITES) return { allowed: false, code: "writes_disabled", reason: "ENABLE_CMS_WRITES is false (default). Live writes are disabled." };
  if (!env.CONTENTSTACK_WRITE_TOKEN) return { allowed: false, code: "writes_disabled", reason: "No separate CONTENTSTACK_WRITE_TOKEN is configured" };
  const allowed = (env.CMS_WRITE_ALLOWED_ENTRY_UIDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!allowed.includes(target.entryUid)) {
    return { allowed: false, code: "forbidden", reason: "Entry is not in CMS_WRITE_ALLOWED_ENTRY_UIDS (writes are limited to designated test entries)" };
  }
  if (!confirm) return { allowed: false, code: "forbidden", reason: "Explicit confirmation is required" };
  return { allowed: true };
}
