"use client";

import { Box, Braces, Calendar, FileText, Hash, Image as ImageIcon, Layers, Link2, ListTree, ToggleLeft, Type } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { SEVERITY_TONE } from "@/components/localization/labels";
import { Badge } from "@/components/ui/badge";
import { Card, Note, SectionTitle } from "@/components/ui/card";
import { CsLink } from "@/components/ui/cs-link";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { csLinks, type LinkBase } from "@/lib/domain/cs-links";
import type { SchemaFinding, SimilarityPair, TypeReport } from "@/lib/domain/schema-governance";
import { SCHEMA_RULES } from "@/lib/domain/schema-governance";
import { cn } from "@/lib/utils/cn";

export interface SlimField {
  path: string; depth: number; kind: string; uid: string; displayName: string; dataType: string;
  mandatory: boolean; nonLocalizable: boolean; multiple: boolean; filled: number; total: number;
}
export type SlimType = Omit<TypeReport, "fieldRows"> & { fieldRows: SlimField[] };

interface Props {
  types: SlimType[];
  findings: SchemaFinding[];
  similarity: SimilarityPair[];
  links: LinkBase | null;
  masterLocale: string;
  localeCount: number;
  initial: { type: string; rule: string };
  ruleCounts: Record<string, number>;
}

const BAND = { low: "text-[#217d63] bg-[#e8f7f0]", medium: "text-[#a06a1f] bg-amber-soft", high: "text-[#b84b40] bg-danger-soft" } as const;
const BAR = { low: "bg-[#138778]", medium: "bg-[#c58a43]", high: "bg-[#c86c63]" } as const;
const ICON: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  text: Type, json: FileText, group: Box, global_field: Layers, blocks: ListTree, reference: Link2, file: ImageIcon, number: Hash, boolean: ToggleLeft, isodate: Calendar, link: Link2, other: Braces,
};

const Pill = ({ band, children }: { band: "low" | "medium" | "high"; children: React.ReactNode }) => <span className={cn("rounded-md px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide", BAND[band])}>{children}</span>;

export function SchemaWorkspace(p: Props) {
  const [selected, setSelected] = useState(p.initial.type);
  const [rule, setRule] = useState(p.initial.rule || "all");
  const [sev, setSev] = useState("all");
  const [type, setType] = useState("all");
  const [q, setQ] = useState("");
  const [pair, setPair] = useState<{ a: string; b: string } | null>(null);

  const open = useCallback((uid: string) => { setSelected(uid); window.history.replaceState(null, "", `?type=${uid}`); }, []);
  const close = useCallback(() => { setSelected(""); window.history.replaceState(null, "", window.location.pathname); }, []);
  const sel = p.types.find((t) => t.uid === selected);
  const maxComplexity = Math.max(60, ...p.types.map((t) => t.complexity));

  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return p.findings.filter((f) => (rule === "all" || f.ruleId === rule) && (sev === "all" || f.severity === sev) && (type === "all" || f.contentTypeUid === type) && (!n || `${f.message} ${f.contentTypeTitle} ${f.fieldPath ?? ""}`.toLowerCase().includes(n)));
  }, [p.findings, rule, sev, type, q]);

  const titleOf = (uid: string) => p.types.find((t) => t.uid === uid)?.title ?? uid;
  const pairSel = pair ? p.similarity.find((s) => (s.a === pair.a && s.b === pair.b) || (s.a === pair.b && s.b === pair.a)) : undefined;
  const cell = (a: string, b: string) => p.similarity.find((s) => (s.a === a && s.b === b) || (s.a === b && s.b === a));
  const order = p.types.map((t) => t.uid);

  return (
    <>
      <Card className="mb-5 p-5">
        <SectionTitle title="Content types" hint="Complexity = fields + 4×depth + 3×block types + 2×groups + references. Change risk reflects entries, inbound references and locales. Click a row for the structure." />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-[10px] uppercase tracking-wider text-[#8194a0]">{["Content type", "Entries", "Fields", "Depth", "Blocks", "Complexity", "Change risk", "Findings", "Score"].map((h) => <th key={h} className="whitespace-nowrap border-b border-[#e8edf0] px-3 py-3 font-extrabold">{h}</th>)}</tr></thead>
            <tbody>
              {p.types.map((t) => (
                <tr key={t.uid} tabIndex={0} role="button" aria-label={`Open ${t.title} structure`} onClick={() => open(t.uid)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(t.uid); } }} className="cursor-pointer border-b border-[#eef1f3] text-[#46606f] hover:bg-[#f5faf9]">
                  <td className="whitespace-nowrap px-3 py-3.5 font-bold text-[#1d3542]">{t.title}</td>
                  <td className="px-3 py-3.5">{t.entries}</td>
                  <td className="px-3 py-3.5">{t.fields}</td>
                  <td className="px-3 py-3.5">{t.maxDepth}</td>
                  <td className="px-3 py-3.5">{t.blockTypes}</td>
                  <td className="px-3 py-3.5"><div className="flex items-center gap-2"><div className="h-2 w-28 overflow-hidden rounded-full bg-[#ecf0f0]" role="img" aria-label={`Complexity ${t.complexity}, ${t.complexityBand}`}><div className={cn("h-full rounded-full", BAR[t.complexityBand])} style={{ width: `${Math.min(100, (t.complexity / maxComplexity) * 100)}%` }} /></div><span className="w-7 font-bold">{t.complexity}</span><Pill band={t.complexityBand}>{t.complexityBand}</Pill></div></td>
                  <td className="whitespace-nowrap px-3 py-3.5"><Pill band={t.risk.band}>{t.risk.band}</Pill> <span className="ml-1 text-muted">{t.risk.score}</span></td>
                  <td className="px-3 py-3.5 font-bold">{t.findings}</td>
                  <td className="px-3 py-3.5"><span className={cn("font-extrabold", t.score < 70 ? "text-danger" : t.score < 90 ? "text-[#a06a1f]" : "text-accent")}>{t.score}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mb-5 grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <Card className="p-5">
          <SectionTitle title="Structural overlap" hint="Shared identical fields (same name and type, excluding title and Global Field members). High overlap = Global Field or merge candidate." />
          <div className="overflow-x-auto">
            <table className="border-separate border-spacing-1 text-[11px]">
              <thead><tr><th />{order.map((u) => <th key={u} scope="col" className="max-w-[72px] truncate px-1 text-center text-[10px] font-semibold text-[#82949f]" title={titleOf(u)}>{titleOf(u).slice(0, 9)}</th>)}</tr></thead>
              <tbody>
                {order.map((r) => (
                  <tr key={r}>
                    <th scope="row" className="whitespace-nowrap pr-2 text-right text-[10px] font-semibold text-[#82949f]">{titleOf(r)}</th>
                    {order.map((c) => {
                      if (r === c) return <td key={c}><div className="h-9 w-12 rounded-md bg-[#eef1f3]" /></td>;
                      const s = cell(r, c);
                      const n = s?.shared.length ?? 0;
                      const a = Math.min(1, (s?.score ?? 0) * 2.2);
                      const on = pair && ((pair.a === r && pair.b === c) || (pair.a === c && pair.b === r));
                      return (
                        <td key={c}>
                          <button onClick={() => setPair({ a: r, b: c })} aria-label={`${titleOf(r)} and ${titleOf(c)} share ${n} fields`} aria-pressed={!!on} className={cn("grid h-9 w-12 place-items-center rounded-md text-[11px] font-bold hover:outline hover:outline-2 hover:outline-[#199c82]", on && "outline outline-2 outline-[#0b635a]")} style={{ background: `rgba(19,135,120,${0.08 + a * 0.75})`, color: a > 0.5 ? "white" : "#2c5b53" }}>{n || "·"}</button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 min-h-[44px] text-[11px] text-[#46606f]" role="status">
            {pairSel ? <><strong>{titleOf(pairSel.a)} ↔ {titleOf(pairSel.b)}</strong>: {pairSel.shared.length ? pairSel.shared.map((x) => x.split(":")[0]).join(", ") : "no identical fields"} ({Math.round(pairSel.score * 100)}% overlap)</> : <span className="text-muted">Click a cell to see which fields are shared. The number is the count of shared fields.</span>}
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle title="Rules" hint="Every score point traces to one of these checks." />
          <div className="max-h-[360px] overflow-y-auto">
            <table className="w-full text-xs">
              <tbody>
                {Object.entries(SCHEMA_RULES).map(([id, r]) => (
                  <tr key={id} className="border-t border-[#eef1f3] first:border-0 align-top">
                    <td className="whitespace-nowrap py-2 pr-3 font-bold">{id}<br /><span className="font-normal text-muted">{r.title}</span></td>
                    <td className="pr-2 text-[11px] text-[#46606f]">{r.logic}</td>
                    <td className="text-right font-bold"><button disabled={!p.ruleCounts[id]} onClick={() => { setRule(id); document.getElementById("schema-findings")?.scrollIntoView({ behavior: "smooth" }); }} className="text-accent hover:underline disabled:text-muted disabled:no-underline">{p.ruleCounts[id] ?? 0}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card className="p-5" id="schema-findings">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-base font-bold">Recommendations</h2><p className="mt-1 text-xs text-muted" role="status">{rows.length} of {p.findings.length} findings</p></div>
          <div className="flex flex-wrap gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="Search" aria-label="Search findings" className="min-h-[39px] min-w-[150px] rounded-lg border border-[#d8e2e7] px-3 text-xs" />
            <select value={rule} onChange={(e) => setRule(e.target.value)} aria-label="Rule filter" className="min-h-[39px] rounded-lg border border-[#d8e2e7] bg-white px-2.5 text-xs"><option value="all">All rules</option>{Object.entries(SCHEMA_RULES).map(([id, r]) => <option key={id} value={id}>{id} · {r.title}</option>)}</select>
            <select value={sev} onChange={(e) => setSev(e.target.value)} aria-label="Severity filter" className="min-h-[39px] rounded-lg border border-[#d8e2e7] bg-white px-2.5 text-xs"><option value="all">All severities</option>{["high", "medium", "low"].map((s) => <option key={s} value={s}>{s}</option>)}</select>
            <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Content type filter" className="min-h-[39px] rounded-lg border border-[#d8e2e7] bg-white px-2.5 text-xs"><option value="all">All content types</option>{p.types.map((t) => <option key={t.uid} value={t.uid}>{t.title}</option>)}</select>
          </div>
        </div>
        <ul className="divide-y divide-[#eef1f3] rounded-lg border border-line">
          {rows.slice(0, 80).map((f) => (
            <li key={f.id}>
              <details>
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-4 py-3 text-xs hover:bg-[#f5faf9]">
                  <Badge tone={SEVERITY_TONE[f.severity]}>{f.severity}</Badge>
                  <span className="font-bold text-[#1d3542]">{f.ruleId}</span>
                  <span className="min-w-0 flex-1 truncate">{f.message}</span>
                  <span className="text-muted">{f.contentTypeTitle}</span>
                </summary>
                <div className="space-y-2 bg-[#fafcfb] px-4 py-3 text-[11px] text-[#46606f]">
                  <ul className="list-disc pl-5">{f.evidence.map((e, i) => <li key={i}>{e}</li>)}</ul>
                  <p className="rounded-lg border border-[#d9ece5] bg-[#eff8f5] p-2.5 text-[#537169]"><strong>Recommendation:</strong> {f.recommendation}</p>
                  <button onClick={() => open(f.contentTypeUid)} className="font-bold text-accent hover:underline">Open {f.contentTypeTitle} structure →</button>
                </div>
              </details>
            </li>
          ))}
          {rows.length === 0 && <li className="px-4 py-8 text-center text-xs text-muted">No findings match the filters.</li>}
        </ul>
        {rows.length > 80 && <p className="mt-2 text-[11px] text-muted">Showing the first 80. Narrow the filters to see the rest.</p>}
      </Card>

      <Sheet open={!!sel} onOpenChange={(o) => { if (!o) close(); }}>
        {sel && (
          <SheetContent eyebrow="Schema governance" title={sel.title} description={`${sel.uid} · ${sel.entries} entries · ${sel.fields} fields · depth ${sel.maxDepth}`}>
            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
              <div className="flex flex-wrap items-center gap-2">
                <Pill band={sel.complexityBand}>complexity {sel.complexity}</Pill>
                <Pill band={sel.risk.band}>change risk {sel.risk.score}</Pill>
                <span className={cn("text-sm font-extrabold", sel.score < 70 ? "text-danger" : sel.score < 90 ? "text-[#a06a1f]" : "text-accent")}>Score {sel.score}</span>
                {p.links && <CsLink href={csLinks.entries(p.links, sel.uid, p.masterLocale)} label={`Open ${sel.title} entries in Contentstack`}>Entries in Contentstack</CsLink>}
              </div>

              <div className="rounded-xl p-4 text-white" style={{ background: "linear-gradient(135deg,#16283a,#0f1824)" }}>
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#7fd6cb]">If you make a breaking change here</div>
                <ul className="mt-2 space-y-1 text-xs text-[#dce8ef]">{sel.risk.rationale.map((r) => <li key={r}>• {r}</li>)}</ul>
                <p className="mt-2 text-[11px] text-[#9fb3c0]">Breaking = removing, renaming or retyping a field, or changing localization settings. Use the field tree below to see how much data each field holds.</p>
              </div>

              <section>
                <div className="field-label">Structure and usage</div>
                <div className="overflow-hidden rounded-lg border border-line">
                  {sel.fieldRows.map((f) => {
                    const Icon = ICON[f.dataType] ?? Braces;
                    const pct = f.total ? Math.round((100 * f.filled) / f.total) : null;
                    const container = f.kind !== "leaf";
                    return (
                      <div key={f.path} className="flex items-center gap-2 border-b border-[#eef1f3] px-3 py-2 text-[11px] last:border-0" style={{ paddingLeft: 12 + (f.depth - 1) * 16 }}>
                        <Icon size={13} className={container ? "text-accent" : "text-[#8aa0b2]"} aria-hidden />
                        <span className="min-w-0 flex-1 truncate"><span className={cn("font-semibold", container && "text-accent")}>{f.uid}</span>{f.mandatory && <span className="text-danger" title="mandatory"> *</span>}<span className="ml-1.5 text-[10px] text-muted">{f.kind === "block_type" ? "block" : f.dataType}{f.multiple ? "[]" : ""}</span></span>
                        {f.dataType === "text" || f.dataType === "json" ? <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold uppercase", f.nonLocalizable ? "bg-[#eef1f3] text-[#6b7b89]" : "bg-[#e8f5f1] text-accent")}>{f.nonLocalizable ? "same in all" : "localized"}</span> : null}
                        {pct === null ? null : (
                          <span className="flex w-28 items-center gap-1.5" title={`${f.filled} of ${f.total} entries`}>
                            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#ecf0f0]"><span className={cn("block h-full rounded-full", pct === 0 ? "bg-[#c86c63]" : pct < 25 ? "bg-[#c58a43]" : "bg-[#138778]")} style={{ width: `${pct}%` }} /></span>
                            <span className={cn("w-8 text-right font-bold", pct === 0 && "text-danger")}>{pct}%</span>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[10px] text-muted">Usage = share of {sel.entries} {p.masterLocale} entries where the field holds a value. “Same in all” fields are shared across locales.</p>
              </section>

              <section>
                <div className="field-label">Findings ({sel.findings})</div>
                {p.findings.filter((f) => f.contentTypeUid === sel.uid).map((f) => (
                  <div key={f.id} className="mb-2 rounded-lg border border-line p-3 text-xs">
                    <div className="flex items-center gap-2"><Badge tone={SEVERITY_TONE[f.severity]}>{f.severity}</Badge><strong>{f.ruleId}</strong><span className="min-w-0 flex-1 truncate">{f.message}</span></div>
                    <p className="mt-1.5 text-[11px] text-muted">{f.recommendation}</p>
                  </div>
                ))}
                {sel.findings === 0 && <Note>No findings for this content type.</Note>}
              </section>
            </div>
          </SheetContent>
        )}
      </Sheet>
    </>
  );
}
