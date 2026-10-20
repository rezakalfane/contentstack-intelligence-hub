import { NextResponse } from "next/server";
import { cancelLiveScan, getProgress, startLiveScan } from "@/lib/server/sync";
import { guardMutation, isResponse, jsonError } from "@/lib/security/request-guard";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(getProgress());
}

/** Starts a READ-ONLY scan of the configured Contentstack stack. */
export function POST(req: Request) {
  const guard = guardMutation(req);
  if (isResponse(guard)) return guard;
  const r = startLiveScan();
  if (!r.started) return jsonError(r.reason, r.reason.includes("already") ? 409 : 400);
  return NextResponse.json(getProgress(), { status: 202 });
}

export function DELETE(req: Request) {
  const guard = guardMutation(req);
  if (isResponse(guard)) return guard;
  return NextResponse.json({ cancelled: cancelLiveScan() });
}
