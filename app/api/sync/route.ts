import { NextResponse } from "next/server";
import { cancelLiveScan, getProgress, startLiveScan } from "@/lib/server/sync";
import { guardMutation, isResponse, jsonError } from "@/lib/security/request-guard";

export const dynamic = "force-dynamic";
/** The scan runs in after() within this request's function; give it the full duration. */
export const maxDuration = 300;

export async function GET() {
  return NextResponse.json(await getProgress());
}

/** Starts a READ-ONLY scan of the configured Contentstack stack. */
export async function POST(req: Request) {
  const guard = guardMutation(req);
  if (isResponse(guard)) return guard;
  const r = await startLiveScan();
  if (!r.started) return jsonError(r.reason, r.reason.includes("already") ? 409 : 400);
  return NextResponse.json(r.progress, { status: 202 });
}

export async function DELETE(req: Request) {
  const guard = guardMutation(req);
  if (isResponse(guard)) return guard;
  return NextResponse.json({ cancelled: await cancelLiveScan() });
}
