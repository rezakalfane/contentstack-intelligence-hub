export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly body: Record<string, unknown>) {
    super(message);
  }
}

/** Same-origin JSON call. The custom header is required by the server-side mutation guard. */
export async function api<T>(url: string, method: "POST" | "DELETE" | "GET", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json", "x-hub-request": "1" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new ApiError(typeof json.error === "string" ? json.error : `Request failed (${res.status})`, res.status, json);
  return json as T;
}
