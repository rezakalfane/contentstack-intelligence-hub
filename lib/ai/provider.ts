import "server-only";
import type { Env, ReasoningEffort } from "@/lib/security/env";
import type { ZodType } from "zod";
import { buildMessages, OUTPUT_JSON_SCHEMA, type TranslationRequest } from "./translator";
import { TranslationOutputSchema, type TranslationOutput } from "./validation";

const OPENAI = "https://api.openai.com/v1";

export class AiError extends Error {
  constructor(
    readonly code: "not_configured" | "model_unavailable" | "unsupported_parameter" | "provider_error" | "invalid_output" | "timeout",
    message: string,
    readonly status = 502,
  ) {
    super(message);
  }
}

export interface ModelProbe {
  ok: boolean;
  model: string;
  message: string;
  checkedAt: string;
}

const probeCache = new Map<string, { at: number; probe: ModelProbe }>();

/** Fail closed: verify the configured model exists on this account. Never substitutes another model. */
export async function probeModel(env: Env, fetchImpl: typeof fetch = fetch): Promise<ModelProbe> {
  const model = env.OPENAI_MODEL;
  const checkedAt = new Date().toISOString();
  if (!env.OPENAI_API_KEY) return { ok: false, model, message: "OPENAI_API_KEY is not set in .env.local", checkedAt };
  const hit = probeCache.get(model);
  if (hit && Date.now() - hit.at < 5 * 60_000 && hit.probe.ok) return hit.probe;
  try {
    const res = await fetchImpl(`${OPENAI}/models/${encodeURIComponent(model)}`, {
      headers: { authorization: `Bearer ${env.OPENAI_API_KEY}` },
      signal: AbortSignal.timeout(15_000),
    });
    let probe: ModelProbe;
    if (res.ok) probe = { ok: true, model, message: `Model "${model}" is accessible with this API key`, checkedAt };
    else if (res.status === 401) probe = { ok: false, model, message: "OpenAI rejected the API key (401)", checkedAt };
    else if (res.status === 404 || res.status === 403) {
      const list = await fetchImpl(`${OPENAI}/models`, { headers: { authorization: `Bearer ${env.OPENAI_API_KEY}` }, signal: AbortSignal.timeout(15_000) }).catch(() => undefined);
      const ids = list?.ok ? (((await list.json()) as { data?: { id: string }[] }).data ?? []).map((m) => m.id).filter((id) => /^(gpt|o\d)/.test(id)).sort().slice(0, 25) : [];
      probe = {
        ok: false, model, checkedAt,
        message: `Model "${model}" is not available to this account (${res.status}). Set OPENAI_MODEL in .env.local to one of: ${ids.join(", ") || "(could not list models)"}`,
      };
    } else probe = { ok: false, model, message: `OpenAI model check failed (${res.status})`, checkedAt };
    probeCache.set(model, { at: Date.now(), probe });
    return probe;
  } catch {
    return { ok: false, model, message: "Could not reach api.openai.com (network error or timeout)", checkedAt };
  }
}

export interface ProviderResult<T = TranslationOutput> {
  output: T;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  /** Effort that was sent (undefined = model default). */
  reasoningEffort?: ReasoningEffort;
}

interface ResponsesBody {
  output_text?: string;
  output?: { type: string; content?: { type: string; text?: string; refusal?: string }[] }[];
  usage?: { input_tokens?: number; output_tokens?: number; output_tokens_details?: { reasoning_tokens?: number } };
  error?: { message?: string; code?: string };
}

/**
 * One hardened path for every model call: key check, model probe (fail closed), strict JSON-schema output,
 * Zod validation, usage capture. Effort comes from env only. Never substitutes a model or drops a parameter.
 */
export async function requestStructured<T>(
  env: Env,
  req: { system: string; user: string; schemaName: string; jsonSchema: object; zod: ZodType<T> },
  fetchImpl: typeof fetch = fetch,
): Promise<ProviderResult<T>> {
  if (!env.OPENAI_API_KEY) throw new AiError("not_configured", "OPENAI_API_KEY is not set in .env.local", 503);
  const probe = await probeModel(env, fetchImpl);
  if (!probe.ok) throw new AiError("model_unavailable", probe.message, 502);

  const body: Record<string, unknown> = {
    model: env.OPENAI_MODEL,
    input: [
      { role: "system", content: req.system },
      { role: "user", content: req.user },
    ],
    text: { format: { type: "json_schema", name: req.schemaName, strict: true, schema: req.jsonSchema } },
    store: false,
  };
  const effort: ReasoningEffort | undefined = env.OPENAI_REASONING_EFFORT; // env is the single source of truth
  if (effort) body.reasoning = { effort };

  let res: Response;
  try {
    res = await fetchImpl(`${OPENAI}/responses`, {
      method: "POST",
      headers: { authorization: `Bearer ${env.OPENAI_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new AiError("timeout", "OpenAI request failed or timed out", 504);
  }
  const json = (await res.json().catch(() => ({}))) as ResponsesBody;
  if (!res.ok) {
    const msg = json.error?.message ?? `OpenAI returned ${res.status}`;
    if (res.status === 400 && /reasoning|effort/i.test(msg)) {
      throw new AiError("unsupported_parameter", `Model "${env.OPENAI_MODEL}" rejected the reasoning parameter: ${msg}. Change OPENAI_REASONING_EFFORT or OPENAI_MODEL in .env.local. (No silent fallback.)`, 400);
    }
    throw new AiError("provider_error", msg, 502);
  }
  const text =
    json.output_text ??
    json.output?.flatMap((o) => o.content ?? []).find((c) => c.type === "output_text")?.text;
  if (!text) {
    const refusal = json.output?.flatMap((o) => o.content ?? []).find((c) => c.type === "refusal")?.refusal;
    throw new AiError("invalid_output", refusal ? `Model refused: ${refusal}` : "Model returned no text output");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AiError("invalid_output", "Model output was not valid JSON");
  }
  const checked = req.zod.safeParse(parsed);
  if (!checked.success) throw new AiError("invalid_output", "Model output did not match the required schema");
  return { output: checked.data, model: env.OPENAI_MODEL, inputTokens: json.usage?.input_tokens, outputTokens: json.usage?.output_tokens, reasoningTokens: json.usage?.output_tokens_details?.reasoning_tokens, reasoningEffort: effort };
}

export function requestTranslation(env: Env, req: TranslationRequest, fetchImpl: typeof fetch = fetch): Promise<ProviderResult> {
  const { system, user } = buildMessages(req);
  return requestStructured(env, { system, user, schemaName: "translation", jsonSchema: OUTPUT_JSON_SCHEMA, zod: TranslationOutputSchema }, fetchImpl);
}
