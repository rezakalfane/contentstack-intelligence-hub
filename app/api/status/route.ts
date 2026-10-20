import { NextResponse } from "next/server";
import { getEnv, publicIntegrationStatus } from "@/lib/security/env";

export const dynamic = "force-dynamic";

/** Booleans and labels only — no secrets. */
export function GET() {
  return NextResponse.json(publicIntegrationStatus(getEnv()));
}
