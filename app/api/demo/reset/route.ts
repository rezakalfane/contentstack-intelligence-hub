import { NextResponse } from "next/server";
import { store } from "@/lib/store/store";
import { guardMutation, isResponse } from "@/lib/security/request-guard";

export function POST(req: Request) {
  const guard = guardMutation(req);
  if (isResponse(guard)) return guard;
  store.reset("demo", "review");
  return NextResponse.json({ reset: true, note: "Demo review state cleared. Contentstack was not touched." });
}
