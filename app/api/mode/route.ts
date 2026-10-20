import { NextResponse } from "next/server";
import { z } from "zod";
import { liveConfigured, MODE_COOKIE } from "@/lib/server/data";
import { guardMutation, isResponse, jsonError } from "@/lib/security/request-guard";

export async function POST(req: Request) {
  const guard = guardMutation(req);
  if (isResponse(guard)) return guard;
  const body = z.object({ mode: z.enum(["live", "demo"]) }).safeParse(await req.json().catch(() => null));
  if (!body.success) return jsonError("mode must be 'live' or 'demo'", 400);
  if (body.data.mode === "live" && !liveConfigured()) return jsonError("Contentstack credentials are not configured in .env.local", 409);
  const res = NextResponse.json({ mode: body.data.mode });
  res.cookies.set(MODE_COOKIE, body.data.mode, { httpOnly: true, sameSite: "strict", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return res;
}
