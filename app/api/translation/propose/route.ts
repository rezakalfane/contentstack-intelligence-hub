import { NextResponse } from "next/server";
import { z } from "zod";
import { getView, resolveMode } from "@/lib/server/data";
import { proposeTranslation, ServiceError } from "@/lib/server/proposals";
import { guardMutation, isResponse, jsonError } from "@/lib/security/request-guard";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

const Body = z.object({ issueId: z.string().min(1), consentToSendContent: z.boolean().default(false) });

export async function POST(req: Request) {
  const guard = guardMutation(req);
  if (isResponse(guard)) return guard;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return jsonError("Invalid request", 400);
  const mode = await resolveMode();
  const view = await getView(mode);
  const issue = view?.diagnostics.find((d) => d.id === body.data.issueId);
  if (!view || !issue) return jsonError("Issue not found in the current dataset", 404);
  try {
    const proposal = await proposeTranslation(mode, issue, {
      consentToSendContent: body.data.consentToSendContent, actorId: guard.actorId, sourceLocale: view.snapshot.masterLocale,
    });
    return NextResponse.json({ proposal });
  } catch (err) {
    if (err instanceof ServiceError) return jsonError(err.message, err.status, { code: err.code });
    return jsonError("Unexpected error generating proposal", 500);
  }
}
