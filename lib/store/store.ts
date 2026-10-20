import "server-only";
import fs from "node:fs";
import path from "node:path";
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

const DIR = path.join(process.cwd(), ".data");
const g = globalThis as unknown as { __hubStore?: Partial<Record<DataMode, StoreData>> };

function file(mode: DataMode) {
  return path.join(DIR, `${mode}.json`);
}

function load(mode: DataMode): StoreData {
  g.__hubStore ??= {};
  const hit = g.__hubStore[mode];
  if (hit) return hit;
  let data: StoreData = { proposals: {}, audit: [] };
  try {
    data = { ...data, ...(JSON.parse(fs.readFileSync(file(mode), "utf8")) as Partial<StoreData>) };
  } catch {
    /* first run */
  }
  g.__hubStore[mode] = data;
  return data;
}

function persist(mode: DataMode, data: StoreData) {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    const tmp = `${file(mode)}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data), { mode: 0o600 });
    fs.renameSync(tmp, file(mode));
  } catch {
    // Read-only filesystem (e.g. serverless): fall back to in-memory state only.
  }
}

export const store = {
  read: (mode: DataMode): StoreData => load(mode),
  update<T>(mode: DataMode, fn: (d: StoreData) => T): T {
    const d = load(mode);
    const out = fn(d);
    persist(mode, d);
    return out;
  },
  reset(mode: DataMode, what: "all" | "review" = "all") {
    const d = load(mode);
    d.proposals = {};
    d.audit = [];
    if (what === "all") d.snapshot = undefined;
    persist(mode, d);
  },
};
