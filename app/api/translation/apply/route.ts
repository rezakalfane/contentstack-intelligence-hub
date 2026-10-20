import { NextResponse } from "next/server";
import { z } from "zod";
import { CmaClient } from "@/lib/adapters/cma-client";
import { createLiveAdapter } from "@/lib/adapters/live-adapter";
import { applyReviewedProposal } from "@/lib/adapters/live-writer";
import { resolveMode } from "@/lib/server/data";
import { findProposal, ServiceError, stepProposal } from "@/lib/server/proposals";
import { makeLiveClient } from "@/lib/server/sync";
import { getEnv, resolveCmaBase } from "@/lib/security/env";
import { guardMutation, isResponse, jsonError } from "@/lib/security/request-guard";
import { evaluateWritePolicy } from "@/lib/security/write-policy";

export const dynamic = "force-dynamic";

const Body = z.object({ proposalId: z.string().min(1), target: z.enum(["demo", "cms"]), confirm: z.boolean().default(false) });

export async function POST(req: Request) {
  const guard = guardMutation(req);
  if (isResponse(guard)) return guard;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return jsonError("Invalid request", 400);
  const mode = await resolveMode();
  const env = getEnv();

  try {
    const proposal = findProposal(mode, body.data.proposalId);

    if (body.data.target === "demo") {
      if (mode !== "demo") return jsonError("'Apply to demo' only exists in DEMO mode. Live data is never modified by this action.", 409);
      return NextResponse.json({ proposal: stepProposal(mode, proposal.id, { type: "apply_to_demo", actorId: guard.actorId }) });
    }

    if (proposal.task === "seo") {
      return jsonError("Live CMS write is not available for SEO suggestions. Copy the approved text into Contentstack.", 409, { code: "seo_write_unsupported" });
    }

    // target === "cms": disabled by default, separately authorised, draft-only, never publishes.
    const decision = evaluateWritePolicy(env, mode, { entryUid: proposal.pointer.entryUid }, body.data.confirm);
    if (!decision.allowed) return jsonError(decision.reason, 403, { code: decision.code });

    const read = makeLiveClient();
    const base = resolveCmaBase(env);
    if ("error" in read || "error" in base || !env.CONTENTSTACK_API_KEY || !env.CONTENTSTACK_WRITE_TOKEN) return jsonError("Write client could not be configured", 503);
    const adapter = createLiveAdapter({ client: read.client, region: base.region, branch: env.CONTENTSTACK_BRANCH, masterLocale: env.CONTENTSTACK_MASTER_LOCALE, environment: env.CONTENTSTACK_ENVIRONMENT });
    const writeClient = new CmaClient({ base: base.base, apiKey: env.CONTENTSTACK_API_KEY, token: env.CONTENTSTACK_WRITE_TOKEN, branch: env.CONTENTSTACK_BRANCH });

    stepProposal(mode, proposal.id, { type: "write_start", actorId: guard.actorId });
    const result = await applyReviewedProposal({ env, mode, adapter, writeClient }, proposal, body.data.confirm);
    const updated = stepProposal(mode, proposal.id, {
      type: "write_result", actorId: guard.actorId, ok: result.ok, readBackVerified: result.ok, error: result.ok ? undefined : result.message,
    });
    if (!result.ok) return jsonError(result.message, result.code === "conflict" ? 409 : 502, { code: result.code, proposal: updated });
    return NextResponse.json({ proposal: updated, entryVersion: result.entryVersion, note: "Draft updated. NOT published." });
  } catch (err) {
    if (err instanceof ServiceError) return jsonError(err.message, err.status, { code: err.code });
    return jsonError("Unexpected error", 500);
  }
}
