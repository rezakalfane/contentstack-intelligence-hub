import "server-only";
import { NextResponse } from "next/server";
import { getEnv } from "./env";

export const HUB_HEADER = "x-hub-request";

/**
 * Mutation guard for a local single-user prototype:
 *  - same-origin only (Origin must match Host when present)
 *  - requires a custom header, which cross-site forms cannot send
 * It is NOT user authentication; production needs a real session/actor (see README).
 */
export function guardMutation(req: Request): NextResponse | { actorId: string } {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin) {
    let ok = false;
    try {
      ok = new URL(origin).host === host;
    } catch {
      ok = false;
    }
    if (!ok) return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  }
  if (req.headers.get(HUB_HEADER) !== "1") {
    return NextResponse.json({ error: `Missing ${HUB_HEADER} header` }, { status: 403 });
  }
  return { actorId: getEnv().HUB_ACTOR_ID };
}

export const isResponse = (v: unknown): v is NextResponse => v instanceof NextResponse;

export function jsonError(message: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}
