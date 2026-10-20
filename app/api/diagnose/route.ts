import { NextResponse } from "next/server";
import { CmaError } from "@/lib/adapters/cma-client";
import { makeLiveClient } from "@/lib/server/sync";
import { getEnv } from "@/lib/security/env";
import { guardMutation, isResponse } from "@/lib/security/request-guard";

export const dynamic = "force-dynamic";

type State = "connected" | "forbidden" | "wrong_region_or_key" | "network_error" | "no_content_types" | "not_configured";

/** Connect & Diagnose: read-only calls, sanitized result. */
export async function POST(req: Request) {
  const guard = guardMutation(req);
  if (isResponse(guard)) return guard;
  const made = makeLiveClient();
  if ("error" in made) return NextResponse.json({ state: "not_configured" as State, message: made.error });
  const { client, region } = made;
  const started = Date.now();
  try {
    const ct = await client.get<{ content_types: unknown[]; count?: number }>("/content_types", { limit: 1, include_count: true });
    const loc = await client.get<{ locales: { code: string; fallback_locale?: string | null }[] }>("/locales").catch((e: unknown) => e as Error);
    const locales = Array.isArray((loc as { locales?: unknown[] }).locales) ? (loc as { locales: { code: string; fallback_locale?: string | null }[] }).locales : null;
    const count = ct.count ?? ct.content_types.length;
    return NextResponse.json({
      state: (count === 0 ? "no_content_types" : "connected") as State,
      message: count === 0 ? "Connected, but the stack has no content types" : "Connected to Contentstack (read-only)",
      region, branch: getEnv().CONTENTSTACK_BRANCH, contentTypes: count, latencyMs: Date.now() - started,
      locales: locales ? locales.map((l) => ({ code: l.code, fallback: l.fallback_locale ?? null })) : null,
      localesNote: locales ? undefined : `Locales unavailable: ${(loc as Error).message}. Partial data — markets will not be invented.`,
    });
  } catch (err) {
    const e = err instanceof CmaError ? err : undefined;
    const state: State = !e || e.kind === "network" || e.kind === "timeout" ? "network_error" : e.kind === "forbidden" ? "forbidden" : e.kind === "unauthorized" || e.kind === "bad_request" || e.kind === "not_found" ? "wrong_region_or_key" : "network_error";
    return NextResponse.json({
      state, region, message: e?.message ?? "Network error",
      hint: state === "wrong_region_or_key" ? "Check CONTENTSTACK_API_BASE_URL matches the stack's hosting region, and that the API key and management token belong to the same stack/branch." : undefined,
    });
  }
}
