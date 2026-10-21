import "server-only";
import fs from "node:fs";
import path from "node:path";
import { BlobPreconditionFailedError, get, put } from "@vercel/blob";
import type { AuditEvent, DataMode, Snapshot, TranslationProposal } from "@/lib/domain/types";

export interface HistoryPoint {
  at: string;
  coverage: number | null;
  health: number | null;
  open: number;
}

export interface StoreData {
  snapshot?: Snapshot;
  /** One point per completed live scan (real trend; never fabricated). */
  history?: HistoryPoint[];
  proposals: Record<string, TranslationProposal>;
  audit: AuditEvent[];
}

/**
 * Two backends behind one async API:
 * - Vercel Blob (private) when a store is connected (BLOB_STORE_ID via OIDC, or BLOB_READ_WRITE_TOKEN).
 *   Serverless instances share nothing in memory and the filesystem is read-only, so every read goes
 *   to Blob (an ETag check; the body is only downloaded when it changed) and writes are compare-and-swap.
 * - Local JSON files in .data/ otherwise (dev, tests, `next start`).
 */
export const blobEnabled = () => Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);

const DIR = path.join(process.cwd(), ".data");
const PREFIX = "hub/";
const g = globalThis as unknown as { __hubDocs?: Map<string, { etag?: string; value: unknown }> };
const cache = () => (g.__hubDocs ??= new Map());

class NotFound {}

async function blobRead<T>(key: string): Promise<{ value: T; etag: string } | null> {
  const hit = cache().get(key);
  const res = await get(`${PREFIX}${key}.json`, { access: "private", useCache: false, ifNoneMatch: hit?.etag });
  if (!res) {
    cache().delete(key);
    return null;
  }
  if (res.statusCode === 304 && hit) return { value: hit.value as T, etag: res.blob.etag };
  if (res.statusCode === 304) throw new NotFound(); // cache evicted between calls: retry without ifNoneMatch
  const value = JSON.parse(await new Response(res.stream).text()) as T;
  cache().set(key, { etag: res.blob.etag, value });
  return { value, etag: res.blob.etag };
}

async function blobWrite(key: string, value: unknown, ifMatch: string | undefined): Promise<void> {
  const r = await put(`${PREFIX}${key}.json`, JSON.stringify(value), {
    access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: ifMatch !== undefined, ifMatch, cacheControlMaxAge: 60,
  });
  cache().set(key, { etag: r.etag, value });
}

function fileRead<T>(key: string): T | null {
  const hit = cache().get(key);
  if (hit) return hit.value as T;
  try {
    const value = JSON.parse(fs.readFileSync(path.join(DIR, `${key}.json`), "utf8")) as T;
    cache().set(key, { value });
    return value;
  } catch {
    return null; // first run
  }
}

function fileWrite(key: string, value: unknown) {
  cache().set(key, { value });
  try {
    fs.mkdirSync(DIR, { recursive: true });
    const file = path.join(DIR, `${key}.json`);
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(value), { mode: 0o600 });
    fs.renameSync(tmp, file);
  } catch {
    // Read-only filesystem without a Blob store: in-memory only (state will not survive other instances).
  }
}

/** Read a JSON document, or null when it does not exist yet. */
export async function readDoc<T>(key: string): Promise<T | null> {
  if (!blobEnabled()) return fileRead<T>(key);
  try {
    return (await blobRead<T>(key))?.value ?? null;
  } catch (err) {
    if (!(err instanceof NotFound)) throw err;
    cache().delete(key);
    return (await blobRead<T>(key))?.value ?? null;
  }
}

/** Overwrite a JSON document (last write wins). For small, single-writer documents such as scan progress. */
export async function writeDoc(key: string, value: unknown): Promise<void> {
  if (!blobEnabled()) return fileWrite(key, value);
  await put(`${PREFIX}${key}.json`, JSON.stringify(value), {
    access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60,
  });
  cache().delete(key);
}

/** Read-modify-write with optimistic concurrency on Blob; `fn` may run more than once and must only mutate its argument. */
export async function updateDoc<D, T>(key: string, empty: () => D, fn: (d: D) => T): Promise<T> {
  if (!blobEnabled()) {
    const d = fileRead<D>(key) ?? empty();
    const out = fn(d);
    fileWrite(key, d);
    return out;
  }
  for (let attempt = 0; ; attempt++) {
    cache().delete(key); // always start from the latest copy
    const cur = await blobRead<D>(key);
    const d = cur ? structuredClone(cur.value) : empty();
    const out = fn(d);
    try {
      await blobWrite(key, d, cur?.etag);
      return out;
    } catch (err) {
      // Someone else wrote first (ETag mismatch, or the blob was created concurrently): retry on fresh data.
      if (attempt < 4 && (err instanceof BlobPreconditionFailedError || (!cur && err instanceof Error && /exist/i.test(err.message)))) continue;
      throw err;
    }
  }
}

const emptyData = (): StoreData => ({ proposals: {}, audit: [] });

export const store = {
  read: async (mode: DataMode): Promise<StoreData> => ({ ...emptyData(), ...(await readDoc<Partial<StoreData>>(mode)) }),
  update<T>(mode: DataMode, fn: (d: StoreData) => T): Promise<T> {
    return updateDoc<StoreData, T>(mode, emptyData, (d) => {
      d.proposals ??= {};
      d.audit ??= [];
      return fn(d);
    });
  },
  reset(mode: DataMode, what: "all" | "review" = "all"): Promise<void> {
    return store.update(mode, (d) => {
      d.proposals = {};
      d.audit = [];
      if (what === "all") d.snapshot = undefined;
    });
  },
};
