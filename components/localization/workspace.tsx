"use client";

import {
  flexRender, getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable,
  type ColumnDef, type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, Download, Sparkles } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { CsLink } from "@/components/ui/cs-link";
import { csLinks, type LinkBase } from "@/lib/domain/cs-links";
import { Button } from "@/components/ui/button";
import { Card, Note, SectionTitle } from "@/components/ui/card";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import type { AuditEvent, CoverageCell, DataMode, LocalizationDiagnostic, TranslationProposal } from "@/lib/domain/types";
import { api } from "@/lib/utils/api";
import { cn } from "@/lib/utils/cn";
import { pct } from "@/lib/utils/format";
import { PROPOSAL_LABEL, SEVERITY_TONE, STATUS_LABEL } from "./labels";
import { ReviewPanel, type ReviewFlags } from "./review-panel";
import { useRouter } from "next/navigation";

export interface WorkspaceProps {
  mode: DataMode;
  provenance: string;
  masterLocale: string;
  locales: { code: string; name: string }[];
  contentTypes: { uid: string; title: string }[];
  matrix: { contentTypeUid: string; title: string; cells: Record<string, CoverageCell> }[];
  links: LinkBase | null;
  diagnostics: LocalizationDiagnostic[];
  proposals: Record<string, TranslationProposal>;
  audit: AuditEvent[];
  flags: ReviewFlags;
  initial: { q: string; locale: string; type: string; status: string; issue: string };
}

const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3 } as const;

function csvCell(v: string): string {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v; // neutralise spreadsheet formulas
  return `"${safe.replaceAll('"', '""')}"`;
}

export function LocalizationWorkspace(p: WorkspaceProps) {
  const router = useRouter();
  const [q, setQ] = useState(p.initial.q);
  const [locale, setLocale] = useState(p.initial.locale);
  const [type, setType] = useState(p.initial.type);
  const [status, setStatus] = useState(p.initial.status);
  const [selectedId, setSelectedId] = useState(p.initial.issue);
  const [sorting, setSorting] = useState<SortingState>([{ id: "severity", desc: false }]);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return p.diagnostics.filter((d) => {
      if (locale !== "all" && d.pointer.locale !== locale) return false;
      if (type !== "all" && d.pointer.contentTypeUid !== type) return false;
      if (status === "open" ? d.status === "resolved" : status !== "all" && d.status !== status) return false;
      if (needle && ![d.title, d.contentTypeTitle, d.fieldLabel, d.pointer.fieldPath, d.pointer.locale, d.pointer.entryUid, d.sourceText].join(" ").toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [p.diagnostics, q, locale, type, status]);

  const openIssue = useCallback((id: string) => {
    setSelectedId(id);
    window.history.replaceState(null, "", `?issue=${id}`);
  }, []);
  const closeIssue = useCallback(() => {
    setSelectedId("");
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const columns = useMemo<ColumnDef<LocalizationDiagnostic>[]>(
    () => [
      {
        id: "select",
        header: () => <span className="sr-only">Select</span>,
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label={`Select ${row.original.title} ${row.original.fieldLabel}`}
            checked={!!picked[row.original.id]}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setPicked((s) => ({ ...s, [row.original.id]: e.target.checked }))}
            disabled={!row.original.proposable}
          />
        ),
        enableSorting: false,
      },
      { id: "entry", header: "Entry", accessorFn: (d) => d.title, cell: ({ row }) => <span className="font-bold text-[#1d3542]">{row.original.title}</span> },
      { id: "type", header: "Content type", accessorFn: (d) => d.contentTypeTitle },
      { id: "locale", header: "Locale", accessorFn: (d) => d.pointer.locale, cell: ({ getValue }) => String(getValue()).toUpperCase() },
      { id: "field", header: "Field", accessorFn: (d) => d.fieldLabel, cell: ({ row }) => <span title={row.original.pointer.fieldPath} className="block max-w-[260px] truncate">{row.original.fieldLabel}</span> },
      { id: "status", header: "Issue", accessorFn: (d) => d.status, cell: ({ row }) => STATUS_LABEL[row.original.status] },
      {
        id: "severity", header: "Severity", accessorFn: (d) => SEV_ORDER[d.severity],
        cell: ({ row }) => <Badge tone={row.original.status === "resolved" ? "low" : SEVERITY_TONE[row.original.severity]}>{row.original.status === "resolved" ? "resolved" : row.original.severity}</Badge>,
        sortingFn: (a, b) => SEV_ORDER[a.original.severity] - SEV_ORDER[b.original.severity] || b.original.priority - a.original.priority,
      },
      { id: "priority", header: "Priority", accessorFn: (d) => d.priority },
      {
        id: "proposal", header: "Proposal", enableSorting: false,
        cell: ({ row }) => { const pr = p.proposals[row.original.id]; return <span className="text-muted">{pr ? PROPOSAL_LABEL[pr.status] : "—"}</span>; },
      },
      { id: "action", header: () => <span className="sr-only">Action</span>, enableSorting: false, cell: ({ row }) => (
          <span className="flex items-center gap-3 font-bold text-accent">
            {row.original.status === "resolved" ? "View" : "Review →"}
            {p.links && <CsLink href={csLinks.entry(p.links, row.original.pointer.contentTypeUid, row.original.pointer.locale, row.original.pointer.entryUid)} label={`Open ${row.original.title} (${row.original.pointer.locale}) in Contentstack`} onClick={(e) => e.stopPropagation()} />}
          </span>
        ) },
    ],
    [picked, p.proposals, p.links],
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table; no memoised children depend on the instance
  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  });

  const selected = p.diagnostics.find((d) => d.id === selectedId);
  const pickedIds = Object.entries(picked).filter(([, v]) => v).map(([k]) => k);

  const exportCsv = () => {
    const head = ["Data source", "Entry", "Entry UID", "Content type", "Locale", "Field path", "Status", "Severity", "Rules", "Existence", "Completeness", "Freshness", "Publication"];
    const rows = filtered.map((d) => [p.provenance, d.title, d.pointer.entryUid, d.contentTypeTitle, d.pointer.locale, d.pointer.fieldPath, d.status, d.severity, d.ruleIds.join(" "), d.existence, d.completeness, d.freshness, d.publication]);
    const csv = [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `contentstack-${p.mode}-localization-issues.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const bulkPropose = async () => {
    const ids = pickedIds.slice(0, 10);
    if (p.mode === "live") {
      const chars = p.diagnostics.filter((d) => ids.includes(d.id)).reduce((n, d) => n + d.sourceText.length, 0);
      setBulkMsg(`DRY RUN — nothing was sent. ${ids.length} field(s), ~${Math.ceil(chars / 4)} input tokens (estimate, 4 chars/token). Open each issue to generate with explicit per-field consent. No proposal is ever auto-approved.`);
      return;
    }
    setBulkBusy(true);
    let ok = 0;
    for (const id of ids) {
      try { await api("/api/translation/propose", "POST", { issueId: id, consentToSendContent: false }); ok++; } catch { /* continue */ }
    }
    setBulkBusy(false);
    setPicked({});
    setBulkMsg(`${ok} simulated proposal(s) created. They are awaiting human review — none were approved.`);
    router.refresh();
  };

  const legend = [["≥ 85%", "bg-[#eaf3ef]"], ["70–84%", "bg-[#fdf3e6]"], ["< 70%", "bg-[#feece6]"], ["N/A", "bg-[#eef1f3]"]] as const;

  return (
    <>
      <Card className="mb-5 p-5">
        <SectionTitle title="Coverage by locale & content type" hint={`Field-level: explicit, non-empty, valid localized values ÷ translatable source fields · ${p.provenance}`} action={<Badge tone="info">Click a cell to filter</Badge>} />
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-1.5 text-[11px]">
            <thead>
              <tr>
                <th scope="col" className="p-2 text-left text-[10px] text-[#82949f]">Content type</th>
                {p.locales.map((l) => <th scope="col" key={l.code} className="p-2 text-center text-[10px] text-[#82949f]" title={l.name}>{l.code.toUpperCase()}</th>)}
              </tr>
            </thead>
            <tbody>
              {p.matrix.map((row) => (
                <tr key={row.contentTypeUid}>
                  <th scope="row" className="whitespace-nowrap p-2 text-left font-bold text-[#395367]"><span className="inline-flex items-center gap-2">{row.title}{p.links && <CsLink href={csLinks.entries(p.links, row.contentTypeUid, p.masterLocale)} label={`Open ${row.title} entries in Contentstack`} />}</span></th>
                  {p.locales.map((l) => {
                    const c = row.cells[l.code];
                    const v = c?.percent ?? null;
                    const tone = v === null ? "bg-[#eef1f3] text-[#6b7b89]" : v < 70 ? "bg-[#feece6] text-[#b95348]" : v < 85 ? "bg-[#fdf3e6] text-[#aa762b]" : "bg-[#eaf3ef] text-[#257260]";
                    const active = locale === l.code && type === row.contentTypeUid;
                    return (
                      <td key={l.code} className="p-0">
                        <button
                          onClick={() => { setLocale(l.code); setType(row.contentTypeUid); table.setPageIndex(0); }}
                          aria-label={`${row.title} in ${l.name}: ${pct(v)} complete (${c?.complete ?? 0} of ${c?.eligible ?? 0} fields). Filter issues.`}
                          aria-pressed={active}
                          className={cn("w-full rounded-md px-3 py-4 text-center text-[12px] font-extrabold hover:outline hover:outline-2 hover:outline-[#199c82]", tone, active && "outline outline-2 outline-[#0b635a]")}
                          title={`${c?.complete ?? 0} / ${c?.eligible ?? 0} fields`}
                        >
                          {pct(v)}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-muted" aria-label="Legend">
          {legend.map(([t, c]) => <span key={t} className="flex items-center gap-1.5"><i className={cn("h-3 w-3 rounded-sm border border-line", c)} />{t}</span>)}
          <span>Fallback-only content is never counted as localized. N/A = no eligible fields (not 100%).</span>
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">Localization issue queue</h2>
            <p className="mt-1 text-xs text-muted" role="status">{filtered.length} matching · {p.diagnostics.filter((d) => d.status !== "resolved").length} open across markets</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="Search entries or fields" aria-label="Search issues" className="min-h-[39px] min-w-[170px] rounded-lg border border-[#d8e2e7] px-3 text-xs" />
            <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Content type filter" className="min-h-[39px] rounded-lg border border-[#d8e2e7] bg-white px-2.5 text-xs">
              <option value="all">All content types</option>
              {p.contentTypes.map((c) => <option key={c.uid} value={c.uid}>{c.title}</option>)}
            </select>
            <select value={locale} onChange={(e) => setLocale(e.target.value)} aria-label="Locale filter" className="min-h-[39px] rounded-lg border border-[#d8e2e7] bg-white px-2.5 text-xs">
              <option value="all">All markets</option>
              {p.locales.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status filter" className="min-h-[39px] rounded-lg border border-[#d8e2e7] bg-white px-2.5 text-xs">
              <option value="open">Open issues</option>
              <option value="all">All statuses</option>
              <option value="missing">Missing</option>
              <option value="incomplete">Incomplete</option>
              <option value="stale">Stale candidate</option>
              <option value="unpublished">Unpublished</option>
              <option value="resolved">Resolved (demo)</option>
            </select>
            <Button onClick={exportCsv}><Download size={14} /> Export CSV</Button>
          </div>
        </div>

        {pickedIds.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-[#d9ece5] bg-[#eff8f5] px-4 py-2.5 text-xs">
            <strong>{pickedIds.length} selected</strong>
            <Button size="sm" variant="primary" onClick={bulkPropose} disabled={bulkBusy}><Sparkles size={12} /> {p.mode === "live" ? "Dry-run proposals" : "Generate simulated proposals"}</Button>
            <span className="text-muted">Proposals are never auto-approved. Max 10 per batch.</span>
          </div>
        )}
        {bulkMsg && <div className="mb-3" role="status"><Note>{bulkMsg}</Note></div>}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="text-left text-[10px] uppercase tracking-wider text-[#8194a0]">
                  {hg.headers.map((h) => (
                    <th key={h.id} scope="col" className="whitespace-nowrap border-b border-[#e8edf0] px-3 py-3 font-extrabold" aria-sort={h.column.getIsSorted() === "asc" ? "ascending" : h.column.getIsSorted() === "desc" ? "descending" : undefined}>
                      {h.column.getCanSort() ? (
                        <button className="inline-flex items-center gap-1 uppercase" onClick={h.column.getToggleSortingHandler()}>
                          {flexRender(h.column.columnDef.header, h.getContext())} <ArrowUpDown size={11} aria-hidden />
                        </button>
                      ) : flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`Review ${row.original.title}, ${row.original.fieldLabel}, ${row.original.pointer.locale}`}
                  onClick={() => openIssue(row.original.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openIssue(row.original.id); } }}
                  className="cursor-pointer border-b border-[#eef1f3] text-[#46606f] hover:bg-[#f5faf9]"
                >
                  {row.getVisibleCells().map((c) => <td key={c.id} className="whitespace-nowrap px-3 py-3.5">{flexRender(c.column.columnDef.cell, c.getContext())}</td>)}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={columns.length} className="px-3 py-10 text-center text-muted">No matching records. Adjust the filters or search.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {table.getPageCount() > 1 && (
          <div className="mt-3 flex items-center justify-between text-xs text-muted">
            <span>Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}</span>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Previous</Button>
              <Button size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Next</Button>
            </div>
          </div>
        )}
      </Card>

      <Sheet open={!!selected} onOpenChange={(o) => { if (!o) closeIssue(); }}>
        {selected && (
          <SheetContent title={selected.title} description={`${selected.contentTypeTitle} · ${selected.pointer.locale.toUpperCase()} · ${selected.fieldLabel}`}>
            <ReviewPanel
              key={selected.id}
              issue={selected}
              proposal={p.proposals[selected.id]}
              audit={p.audit.filter((e) => e.issueId === selected.id)}
              mode={p.mode}
              flags={p.flags}
              links={p.links}
            />
          </SheetContent>
        )}
      </Sheet>
    </>
  );
}
