import { sleep } from "@/lib/utils/pool";

export type CmaErrorKind = "unauthorized" | "forbidden" | "not_found" | "rate_limited" | "server" | "network" | "timeout" | "bad_request";

export class CmaError extends Error {
  constructor(
    readonly kind: CmaErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export interface CmaConfig {
  base: string;
  apiKey: string;
  token: string;
  branch?: string;
  timeoutMs?: number;
  maxRetries?: number;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  baseDelayMs?: number;
}

function kindOf(status: number): CmaErrorKind {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server";
  return "bad_request";
}

/** Thin read-only CMA client. Credentials stay inside this object; error messages never include headers. */
export class CmaClient {
  private calls = 0;
  constructor(private readonly cfg: CmaConfig) {}

  get callCount() {
    return this.calls;
  }

  /** Single-attempt write (no retries: a retried PUT could be applied twice). Only used by the guarded writer. */
  async put<T>(path: string, body: unknown, query: Record<string, string | number | boolean | undefined> = {}): Promise<T> {
    return this.request<T>("PUT", path, query, undefined, body, 0);
  }

  async get<T>(path: string, query: Record<string, string | number | boolean | undefined> = {}, signal?: AbortSignal): Promise<T> {
    return this.request<T>("GET", path, query, signal);
  }

  private async request<T>(
    method: "GET" | "PUT",
    path: string,
    query: Record<string, string | number | boolean | undefined>,
    signal?: AbortSignal,
    body?: unknown,
    retries?: number,
  ): Promise<T> {
    const url = new URL(`${this.cfg.base}/v3${path}`);
    for (const [k, v] of Object.entries(query)) if (v !== undefined) url.searchParams.set(k, String(v));
    const headers: Record<string, string> = { api_key: this.cfg.apiKey, authorization: this.cfg.token, "content-type": "application/json" };
    if (this.cfg.branch) headers.branch = this.cfg.branch;
    const doFetch = this.cfg.fetchImpl ?? fetch;
    const max = retries ?? this.cfg.maxRetries ?? 7;

    for (let attempt = 0; ; attempt++) {
      this.calls++;
      const timeout = AbortSignal.timeout(this.cfg.timeoutMs ?? 20_000);
      const sig = signal ? AbortSignal.any([signal, timeout]) : timeout;
      let res: Response | undefined;
      let failure: CmaError | undefined;
      try {
        res = await doFetch(url, { method, headers, signal: sig, cache: "no-store", body: body === undefined ? undefined : JSON.stringify(body) });
      } catch (err) {
        if (signal?.aborted) throw err;
        const timedOut = timeout.aborted;
        failure = new CmaError(timedOut ? "timeout" : "network", timedOut ? `Timed out calling ${path}` : `Network error calling ${path}`);
      }
      if (res?.ok) return (await res.json()) as T;
      if (res) {
        const body = (await res.json().catch(() => ({}))) as { error_message?: string; error_code?: number; errors?: unknown };
        const extra = body.errors ? ` ${JSON.stringify(body.errors).slice(0, 300)}` : "";
        const detail = body.error_message ? `: ${body.error_message}${extra}` : "";
        failure = new CmaError(kindOf(res.status), `CMA ${res.status} on ${path}${detail}`, res.status);
        if (res.status === 429 || res.status >= 500) {
          const retryAfter = Number(res.headers.get("retry-after"));
          if (attempt < max) {
            await sleep(this.delay(attempt, retryAfter), signal);
            continue;
          }
        }
      } else if (failure && attempt < max) {
        await sleep(this.delay(attempt), signal);
        continue;
      }
      throw failure as CmaError;
    }
  }

  private delay(attempt: number, retryAfterSec?: number): number {
    if (retryAfterSec && Number.isFinite(retryAfterSec)) return Math.min(retryAfterSec * 1000, 20_000) + Math.random() * 250;
    const base = Math.min((this.cfg.baseDelayMs ?? 500) * 2 ** attempt, 20_000);
    return base / 2 + Math.random() * (base / 2); // exponential backoff with jitter
  }
}
