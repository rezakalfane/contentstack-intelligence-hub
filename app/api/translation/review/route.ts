import { NextResponse } from "next/server";
import { z } from "zod";
import { getView, resolveMode } from "@/lib/server/data";
import { findProposal, reviewProposal, ServiceError } from "@/lib/server/proposals";
import { guardMutation, isResponse, jsonError } from "@/lib/security/request-guard";

export const dynamic = "force-dynamic";

const Body = z.object({
  proposalId: z.string().min(1),
  action: z.enum(["open", "edit", "approve", "reject", "rebase"]),
  text: z.string().max(20_000).optional(),
  comment: z.string().max(1000).optional(),
});

/** Approve/reject decisions. Approving NEVER writes to Contentstack. */
export async function POST(req: Request) {
  const guard = guardMutation(req);
  if (isResponse(guard)) return guard;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return jsonError("Invalid request", 400);
  const mode = await resolveMode();
  const view = await getView(mode);
  try {
    const issueId = findProposal(mode, body.data.proposalId).issueId;
    const current = view?.diagnostics.find((d) => d.id === issueId);
    const proposal = reviewProposal(mode, body.data.proposalId, body.data.action, guard.actorId, current, body.data);
    return NextResponse.json({ proposal });
  } catch (err) {
    if (err instanceof ServiceError) return jsonError(err.message, err.status, { code: err.code });
    return jsonError("Unexpected error", 500);
  }
}
