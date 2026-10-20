import { NextResponse } from "next/server";
import { z } from "zod";
import { getSeoView, resolveMode } from "@/lib/server/data";
import { proposeSeoText, ServiceError } from "@/lib/server/proposals";
import { guardMutation, isResponse, jsonError } from "@/lib/security/request-guard";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

const Body = z.object({ findingId: z.string().min(1), consentToSendContent: z.boolean().default(false) });

export async function POST(req: Request) {
  const guard = guardMutation(req);
  if (isResponse(guard)) return guard;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return jsonError("Invalid request", 400);
  const mode = await resolveMode();
  const view = await getSeoView(mode);
  const finding = view?.findings.find((f) => f.id === body.data.findingId);
  if (!view || !finding) return jsonError("Finding not found in the current dataset", 404);
  try {
    return NextResponse.json({ proposal: await proposeSeoText(mode, finding, { consentToSendContent: body.data.consentToSendContent }) });
  } catch (err) {
    if (err instanceof ServiceError) return jsonError(err.message, err.status, { code: err.code });
    return jsonError("Unexpected error generating suggestion", 500);
  }
}
