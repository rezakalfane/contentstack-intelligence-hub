"use client";

import { ChevronDown, Menu, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/utils/api";
import { cn } from "@/lib/utils/cn";
import { NAV } from "./nav-items";

export interface ShellProps {
  mode: "live" | "demo";
  liveConfigured: boolean;
  provenance: string;
  stackLabel: string;
  freshness: string;
  children: React.ReactNode;
}

export function Shell({ mode, liveConfigured, provenance, stackLabel, freshness, children }: ShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const switchMode = async (next: "live" | "demo") => {
    setMenu(false);
    setErr(null);
    try {
      await api("/api/mode", "POST", { mode: next });
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not switch mode");
    }
  };

  const nav = (
    <nav aria-label="Primary" className="flex flex-col">
      {(["WORKSPACE", "EXPLORE"] as const).map((group) => (
        <div key={group}>
          <div className="px-3 pb-2 pt-4 text-[10px] font-extrabold tracking-[1.5px] text-[#79919e]">{group}</div>
          {NAV.filter((n) => n.group === group).map((n) => {
            const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "my-0.5 flex items-center gap-3 rounded-[10px] px-3 py-3 text-[13px] font-semibold",
                  active ? "bg-[#284237] text-[#eefbf5]" : "text-[#abbac5] hover:bg-ink-2 hover:text-white",
                )}
              >
                <n.icon size={17} aria-hidden /> {n.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  return (
    <div className="grid min-h-screen lg:grid-cols-[254px_minmax(0,1fr)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3">Skip to content</a>
      <aside className="sticky top-0 hidden h-screen flex-col bg-ink px-4 py-7 text-white lg:flex">
        <Logo />
        {nav}
        <div className="mt-auto border-t border-[#354453] px-3 pt-5 text-[11px] text-[#91a4b2]">
          <div className="mb-2 flex items-center gap-2 text-xs text-[#d5e3de]">
            <i className={cn("h-[7px] w-[7px] rounded-full", mode === "live" ? "bg-[#4ac2a6]" : "bg-amber")} /> {mode === "live" ? "Live read-only" : "Offline sample data"}
          </div>
          Independent prototype · not affiliated with Contentstack
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button className="absolute inset-0 bg-[rgba(9,25,37,.55)]" aria-label="Close navigation" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 overflow-y-auto bg-ink px-4 py-6 text-white">
            <div className="flex items-start justify-between">
              <Logo />
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="rounded-lg p-2 hover:bg-ink-2"><X size={18} /></button>
            </div>
            {nav}
          </aside>
        </div>
      )}

      <div className="min-w-0">
        <header className="flex min-h-[72px] flex-wrap items-center justify-between gap-3 border-b border-line bg-white px-4 py-3 sm:px-9">
          <div className="flex items-center gap-3">
            <button className="rounded-lg border border-line p-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={18} /></button>
            <form
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                router.push(`/localization?q=${encodeURIComponent(q)}`);
              }}
              className="relative"
            >
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9aabb5]" aria-hidden />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Search entries and fields"
                placeholder="Search entries, fields…"
                className="min-h-[38px] w-44 rounded-lg border border-[#d8e2e7] bg-white pl-8 pr-3 text-xs placeholder:text-[#9aabb5] sm:w-64"
              />
            </form>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="hidden text-[11px] text-muted md:inline" title="Time of the data currently shown">{freshness}</span>
            <Badge tone={mode === "live" ? "live" : "demo"} className="px-2.5 py-1.5 text-[10px] tracking-[1px]">{provenance}</Badge>
            <div className="relative">
              <button
                onClick={() => setMenu((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menu}
                className="flex min-h-[38px] items-center gap-2 rounded-lg border border-line bg-white px-3 text-xs font-semibold"
              >
                {stackLabel} <ChevronDown size={14} aria-hidden />
              </button>
              {menu && (
                <div role="menu" className="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-line bg-white p-2 shadow-card">
                  <button role="menuitem" onClick={() => switchMode("live")} disabled={!liveConfigured} className="w-full rounded-lg px-3 py-2.5 text-left text-xs hover:bg-canvas disabled:opacity-50">
                    <strong className="block">LIVE · Contentstack</strong>
                    <span className="text-muted">{liveConfigured ? "Read-only scan of your configured stack" : "Add credentials to .env.local to enable"}</span>
                  </button>
                  <button role="menuitem" onClick={() => switchMode("demo")} className="w-full rounded-lg px-3 py-2.5 text-left text-xs hover:bg-canvas">
                    <strong className="block">DEMO · Sample fixtures</strong>
                    <span className="text-muted">Offline sample data, 5 locales, 56 entries</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        {err && <div role="alert" className="border-b border-[#f0c9c5] bg-danger-soft px-9 py-2 text-xs text-[#8f2f2a]">{err}</div>}
        <main id="main" className="mx-auto max-w-[1480px] px-4 pb-20 pt-8 sm:px-9">{children}</main>
      </div>
    </div>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-3 px-3 pb-6">
      <div className="grid h-[38px] w-[38px] place-items-center rounded-[10px] bg-[#38baa2] text-[22px] font-black text-[#103a36]" aria-hidden>✳</div>
      <div>
        <strong className="block text-sm tracking-tight">intelligence<span className="text-[#40c3ab]">.</span>hub</strong>
        <small className="mt-1 block text-[10px] tracking-[1.4px] text-[#91a4b2]">FOR CONTENTSTACK</small>
      </div>
    </div>
  );
}
