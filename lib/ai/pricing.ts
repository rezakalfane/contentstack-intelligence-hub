import type { Env } from "@/lib/security/env";

export interface Usage {
  inputTokens?: number;
  outputTokens?: number;
}

/** Cost = reported token usage × prices YOU configure. Returns undefined (never 0) when unpriced. */
export function costFromUsage(env: Pick<Env, "OPENAI_PRICE_INPUT_PER_MTOK" | "OPENAI_PRICE_OUTPUT_PER_MTOK">, u: Usage): number | undefined {
  const pin = env.OPENAI_PRICE_INPUT_PER_MTOK;
  const pout = env.OPENAI_PRICE_OUTPUT_PER_MTOK;
  if (pin === undefined || pout === undefined || u.inputTokens === undefined || u.outputTokens === undefined) return undefined;
  return (u.inputTokens * pin + u.outputTokens * pout) / 1_000_000;
}
