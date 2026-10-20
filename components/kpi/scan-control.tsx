"use client";

import { Loader2, RefreshCw, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ScanProgress } from "@/lib/domain/types";
import { api } from "@/lib/utils/api";

export function ScanControl({ label = "Scan Contentstack", variant = "primary" }: { label?: string; variant?: "primary" | "default" }) {
  const router = useRouter();
  const [p, setP] = useState<ScanProgress | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  // Keep the latest router in a ref: its identity can change between renders, and depending on it
  // in an effect caused a fetch → setState → render → fetch loop (visible as a flickering button).
  const routerRef = useRef(router);
  useEffect(() => { routerRef.current = router; });

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);

  const poll = useCallback(() => {
    stop();
    timer.current = setInterval(async () => {
      try {
        const next = await api<ScanProgress>("/api/sync", "GET");
        setP(next);
        if (next.state !== "running") {
          stop();
          routerRef.current.refresh();
        }
      } catch {
        stop();
      }
    }, 800);
  }, [stop]);

  // Once on mount: pick up a scan that is already running (e.g. after navigation).
  useEffect(() => {
    let alive = true;
    api<ScanProgress>("/api/sync", "GET")
      .then((s) => { if (alive) { setP(s); if (s.state === "running") poll(); } })
      .catch(() => undefined);
    return () => { alive = false; stop(); };
  }, [poll, stop]);

  const start = async () => {
    setErr(null);
    try {
      setP(await api<ScanProgress>("/api/sync", "POST"));
      poll();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not start scan");
    }
  };
  const cancel = async () => { await api("/api/sync", "DELETE").catch(() => undefined); };
  const running = p?.state === "running";

  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex items-center gap-2">
        {running ? (
          <>
            <Button variant="default" disabled aria-live="polite"><Loader2 size={14} className="animate-spin" /> Scanning…</Button>
            <Button variant="danger" onClick={cancel}><Square size={12} /> Cancel</Button>
          </>
        ) : (
          <Button variant={variant} onClick={start}><RefreshCw size={14} /> {label}</Button>
        )}
      </div>
      {running && (
        <div className="w-full min-w-[260px]">
          <div
            role="progressbar"
            aria-label="Scan progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={p.percent ?? 0}
            aria-valuetext={`${p.phase}, ${p.percent ?? 0}%`}
            className="h-2 overflow-hidden rounded-full bg-[#ecf0f0]"
          >
            <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${p.percent ?? 0}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted">
            <span>{p.phase}{p.total ? ` · ${p.done}/${p.total} entries` : ""}</span>
            <span className="font-bold">{p.percent ?? 0}%</span>
          </div>
        </div>
      )}
      {p && !running && p.state !== "idle" && (
        <span role="status" className="text-[11px] text-muted">
          Last scan: {p.state}{p.message ? ` — ${p.message}` : ""}{p.errors.length ? ` · ${p.errors.length} problem(s)` : ""}
        </span>
      )}
      {err && <span role="alert" className="text-[11px] text-danger">{err}</span>}
    </div>
  );
}
