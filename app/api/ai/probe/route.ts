import { NextResponse } from "next/server";
import { probeModel } from "@/lib/ai/provider";
import { getEnv } from "@/lib/security/env";
import { guardMutation, isResponse } from "@/lib/security/request-guard";

export const dynamic = "force-dynamic";

/** Checks that OPENAI_MODEL exists for this account. Sends no CMS content. */
export async function POST(req: Request) {
  const guard = guardMutation(req);
  if (isResponse(guard)) return guard;
  return NextResponse.json(await probeModel(getEnv()));
}
