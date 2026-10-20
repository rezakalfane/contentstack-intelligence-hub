"use client";

import { Check, Copy, Loader2, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { PROPOSAL_LABEL, SEVERITY_TONE } from "@/components/localization/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, Note, SectionTitle } from "@/components/ui/card";
import { CsLink } from "@/components/ui/cs-link";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { csLinks, type LinkBase } from "@/lib/domain/cs-links";
import { SEO_RULES } from "@/lib/domain/seo";
import type { AuditEvent, DataMode, SeoFinding, TranslationProposal } from "@/lib/domain/types";
import { api, ApiError } from "@/lib/utils/api";
import { cn } from "@/lib/utils/cn";
import { usd } from "@/lib/utils/format";

export interface SeoFlags {
  aiTransferAllowed: boolean;
  openaiConfigured: boolean;
  model: string;
  reasoningEffort: string | null;
}

interface Props {
  mode: DataMode;
  findings: SeoFinding[];
  proposals: Record<string, TranslationProposal>;
  audit: AuditEvent[];
  contentTypes: { uid: string; title: string }[];
  links: LinkBase | null;
  flags: SeoFlags;
  initial: { finding: string; rule: string; category: string };
  ruleCounts: Record<string, number>;
}

const FIX: Record<string, string> = {
  "SEO-000": "Add a meta title and meta description field (or an SEO global field) to the content type so editors can control search snippets.",
  "SEO-001": "Write a 70–155 character summary that says what the page offers. Use the AI suggestion as a starting point.",
  "SEO-002": "Rewrite so the description lands between 50 and 165 characters; put the key information first.",
  "SEO-003": "Aim for 15–60 characters, lead with the primary topic, keep the brand last.",
  "SEO-004": "Give every page its own title/description; duplicates make pages compete with each other.",
  "SEO-005": "Use lowercase words separated by hyphens, no query strings, under 75 characters. Add a redirect if the URL is already live.",
  "SEO-006": "If the page should rank, switch indexing back on. Otherwise ignore this finding.",
  "SEO-007": "Describe what the image shows in one short phrase. Leave decorative images empty only if the schema supports it.",
  "SEO-008": "Break the body into sections with H2/H3 headings, use one H1, and don't skip levels.",
  "SEO-009": "Expand the article or merge it into a stronger page; thin pages seldom satisfy search intent.",
  "AIO-001": "Open with a direct 1–2 sentence answer (under ~35 words), then add detail below.",
  "AIO-002": "Replace “click here” with words that describe the destination.",
  "AIO-003": "Split long paragraphs, add lists or subheadings so people and AI assistants can scan and quote.",
  "AIO-004": "Fill in the listed fields so Article / FAQPage / Product structured data can be generated completely.",
  "AIO-005": "Add a publish date, or review and refresh content older than 24 months.",
  "AIO-006": "Add the author. Named authorship is a trust signal for readers and AI assistants.",
};

export function SeoWorkspace(p: Props) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState(p.initial.category || "all");
  const [severity, setSeverity] = useState("all");
  const [rule, setRule] = useState(p.initial.rule || "all");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("open");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState(p.initial.finding);
  const PAGE = 15;

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return p.findings.filter((f) => {
      if (category !== "all" && f.category !== category) return false;
      if (severity !== "all" && f.severity !== severity) return false;
      if (rule !== "all" && f.ruleId !== rule) return false;
      if (type !== "all" && f.contentTypeUid !== type) return false;
      if (status !== "all" && f.status !== status) return false;
      if (needle && ![f.title, f.message, f.contentTypeTitle, f.fieldLabel ?? "", f.ruleId].join(" ").toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [p.findings, q, category, severity, rule, type, status]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const shown = rows.slice(page * PAGE, page * PAGE + PAGE);
  const selected = p.findings.find((f) => f.id === selectedId);

  const open = useCallback((id: string) => { setSelectedId(id); window.history.replaceState(null, "", `?finding=${id}`); }, []);
  const close = useCallback(() => { setSelectedId(""); window.history.replaceState(null, "", window.location.pathname); }, []);
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(0); };

  return (
    <>
      <Card className="p-5" id="findings">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">Findings</h2>
            <p className="mt-1 text-xs text-muted" role="status">{rows.length} matching · {p.findings.filter((f) => f.status === "open").length} open</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input value={q} onChange={(e) => reset(setQ)(e.target.value)} type="search" placeholder="Search findings" aria-label="Search findings" className="min-h-[39px] min-w-[160px] rounded-lg border border-[#d8e2e7] px-3 text-xs" />
            <select value={category} onChange={(e) => reset(setCategory)(e.target.value)} aria-label="Area filter" className="min-h-[39px] rounded-lg border border-[#d8e2e7] bg-white px-2.5 text-xs"><option value="all">SEO + AI</option><option value="seo">SEO</option><option value="ai">AI discoverability</option></select>
            <select value={severity} onChange={(e) => reset(setSeverity)(e.target.value)} aria-label="Severity filter" className="min-h-[39px] rounded-lg border border-[#d8e2e7] bg-white px-2.5 text-xs"><option value="all">All severities</option>{["critical", "high", "medium", "low"].map((s) => <option key={s} value={s}>{s}</option>)}</select>
            <select value={rule} onChange={(e) => reset(setRule)(e.target.value)} aria-label="Rule filter" className="min-h-[39px] rounded-lg border border-[#d8e2e7] bg-white px-2.5 text-xs"><option value="all">All rules</option>{Object.entries(SEO_RULES).map(([id, r]) => <option key={id} value={id}>{id} · {r.title}</option>)}</select>
            <select value={type} onChange={(e) => reset(setType)(e.target.value)} aria-label="Content type filter" className="min-h-[39px] rounded-lg border border-[#d8e2e7] bg-white px-2.5 text-xs"><option value="all">All content types</option>{p.contentTypes.map((c) => <option key={c.uid} value={c.uid}>{c.title}</option>)}</select>
            <select value={status} onChange={(e) => reset(setStatus)(e.target.value)} aria-label="Status filter" className="min-h-[39px] rounded-lg border border-[#d8e2e7] bg-white px-2.5 text-xs"><option value="open">Open</option><option value="resolved">Resolved (demo)</option><option value="all">All</option></select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead><tr className="text-left text-[10px] uppercase tracking-wider text-[#8194a0]">{["Severity", "Rule", "Entry", "Finding", "Field", "Fix", ""].map((h) => <th key={h} className="whitespace-nowrap border-b border-[#e8edf0] px-3 py-3 font-extrabold">{h}</th>)}</tr></thead>
            <tbody>
              {shown.map((f) => {
                const pr = p.proposals[f.id];
                return (
                  <tr key={f.id} tabIndex={0} role="button" aria-label={`Review ${f.ruleId} on ${f.title}`} onClick={() => open(f.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(f.id); } }} className="cursor-pointer border-b border-[#eef1f3] text-[#46606f] hover:bg-[#f5faf9]">
                    <td className="px-3 py-3.5"><Badge tone={f.status === "resolved" ? "low" : SEVERITY_TONE[f.severity]}>{f.status === "resolved" ? "resolved" : f.severity}</Badge></td>
                    <td className="whitespace-nowrap px-3 py-3.5 font-bold text-[#1d3542]">{f.ruleId}<span className="ml-2 font-normal"><Badge tone={f.category === "ai" ? "info" : "neutral"}>{f.category === "ai" ? "AI" : "SEO"}</Badge></span></td>
                    <td className="whitespace-nowrap px-3 py-3.5 font-bold text-[#1d3542]">{f.title}<br /><span className="font-normal text-muted">{f.contentTypeTitle}</span></td>
                    <td className="max-w-[320px] px-3 py-3.5">{f.message}</td>
                    <td className="whitespace-nowrap px-3 py-3.5">{f.fieldLabel ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-3.5">{pr ? <span className="text-muted">{PROPOSAL_LABEL[pr.status]}</span> : f.proposable ? <Badge tone="live"><Sparkles size={10} /> AI suggestion</Badge> : <span className="text-muted">Editorial</span>}</td>
                    <td className="px-3 py-3.5 font-bold text-accent">{f.status === "resolved" ? "View" : "Review →"}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={7} className="px-3 py-10 text-center text-muted">No findings match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="mt-3 flex items-center justify-between text-xs text-muted">
            <span>Page {page + 1} of {pages}</span>
            <div className="flex gap-2"><Button size="sm" onClick={() => setPage((x) => x - 1)} disabled={page === 0}>Previous</Button><Button size="sm" onClick={() => setPage((x) => x + 1)} disabled={page + 1 >= pages}>Next</Button></div>
          </div>
        )}
      </Card>

      <Card className="mt-5 p-5">
        <SectionTitle title="Rules" hint="Every score is reproducible from these checks. Click a count to filter the findings." />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-[10px] uppercase tracking-wider text-[#8194a0]"><th className="py-2">Rule</th><th>Area</th><th>Detection logic</th><th className="text-right">Open</th></tr></thead>
            <tbody>
              {Object.entries(SEO_RULES).map(([id, r]) => (
                <tr key={id} className="border-t border-[#eef1f3] align-top">
                  <td className="whitespace-nowrap py-2.5 pr-3 font-bold">{id}<br /><span className="font-normal text-muted">{r.title}</span></td>
                  <td className="pr-3"><Badge tone={r.category === "ai" ? "info" : "neutral"}>{r.category === "ai" ? "AI discoverability" : "SEO"}</Badge></td>
                  <td className="pr-3 text-[#46606f]">{r.logic}</td>
                  <td className="text-right font-bold"><button className="text-accent hover:underline disabled:text-muted disabled:no-underline" disabled={!p.ruleCounts[id]} onClick={() => { setRule(id); setStatus("open"); setPage(0); document.getElementById("findings")?.scrollIntoView({ behavior: "smooth" }); }}>{p.ruleCounts[id] ?? 0}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Sheet open={!!selected} onOpenChange={(o) => { if (!o) close(); }}>
        {selected && (
          <SheetContent title={selected.title} description={`${selected.contentTypeTitle} · ${selected.ruleId} ${SEO_RULES[selected.ruleId]?.title ?? ""}`}>
            <SeoPanel key={selected.id} finding={selected} proposal={p.proposals[selected.id]} audit={p.audit.filter((e) => e.issueId === selected.id)} mode={p.mode} flags={p.flags} links={p.links} />
          </SheetContent>
        )}
      </Sheet>
    </>
  );
}

function CharGauge({ n, min, max }: { n: number; min: number; max: number }) {
  const ok = n >= min && n <= max;
  const pct = Math.min(100, (n / (max * 1.3)) * 100);
  return (
    <div aria-live="polite">
      <div className="relative h-2 overflow-hidden rounded-full bg-[#ecf0f0]">
        <div className="absolute inset-y-0 rounded-full bg-[#cfeadf]" style={{ left: `${(min / (max * 1.3)) * 100}%`, width: `${((max - min) / (max * 1.3)) * 100}%` }} />
        <div className={cn("relative h-full rounded-full transition-[width]", ok ? "bg-[#138778]" : "bg-[#c58a43]")} style={{ width: `${pct}%` }} />
      </div>
      <p className={cn("mt-1 text-[11px]", ok ? "text-accent" : "text-[#8a5a14]")}>{n} characters · target {min}–{max}{ok ? " ✓" : n < min ? " (too short)" : " (too long)"}</p>
    </div>
  );
}

function SeoPanel({ finding, proposal, audit, mode, flags, links }: { finding: SeoFinding; proposal?: TranslationProposal; audit: AuditEvent[]; mode: DataMode; flags: SeoFlags; links: LinkBase | null }) {
  const router = useRouter();
  const [text, setText] = useState(proposal ? (proposal.editedText ?? proposal.suggestedText) : "");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const live = mode === "live";
  const rev = proposal ? `${proposal.id}@${proposal.updatedAt}` : "";
  const [seen, setSeen] = useState(rev);
  if (seen !== rev) { setSeen(rev); if (proposal) setText(proposal.editedText ?? proposal.suggestedText); }

  const editable = proposal ? ["proposed", "in_review"].includes(proposal.status) : false;
  const dirty = proposal && editable && text !== (proposal.editedText ?? proposal.suggestedText);
  const sg = finding.suggestion;

  const run = async (label: string, fn: () => Promise<unknown>, done?: string) => {
    setBusy(label); setError(null); setInfo(null);
    try { await fn(); if (done) setInfo(done); router.refresh(); }
    catch (e) { setError(e instanceof ApiError || e instanceof Error ? e.message : "Request failed"); router.refresh(); }
    finally { setBusy(null); }
  };
  const review = (action: "edit" | "approve" | "reject", done: string) => run(action, () => api("/api/translation/review", "POST", { proposalId: proposal?.id, action, text }), done);

  return (
    <>
      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={finding.status === "resolved" ? "low" : SEVERITY_TONE[finding.severity]}>{finding.status === "resolved" ? "resolved (demo)" : finding.severity}</Badge>
            <Badge tone={finding.category === "ai" ? "info" : "neutral"}>{finding.category === "ai" ? "AI discoverability" : "SEO"}</Badge>
            {proposal && <Badge tone="info">{PROPOSAL_LABEL[proposal.status]}</Badge>}
            <span className="text-[11px] text-muted">−{finding.penalty} points</span>
          </div>
          <p className="text-sm font-semibold">{finding.message}</p>
          <ul className="list-disc space-y-1 pl-5 text-[11px] text-[#46606f]">{finding.evidence.map((e, i) => <li key={i}>{e}</li>)}</ul>
          <div className="rounded-lg border border-[#d9ece5] bg-[#eff8f5] p-3 text-[11px] leading-relaxed text-[#537169]"><strong>How to fix:</strong> {FIX[finding.ruleId]}</div>
          {links && finding.entryUid && (
            <div className="flex flex-wrap gap-5">
              <CsLink href={csLinks.entry(links, finding.contentTypeUid, finding.locale, finding.entryUid)} label={`Open ${finding.title} in Contentstack`}>Open entry in Contentstack</CsLink>
            </div>
          )}
          {finding.fieldPath && <p className="font-mono text-[10px] text-muted">{finding.contentTypeUid}/{finding.entryUid ?? "—"} · {finding.locale} · {finding.fieldPath}</p>}
        </section>

        {finding.current !== undefined && finding.fieldPath && (
          <section>
            <div className="field-label">Current {finding.fieldLabel?.toLowerCase()}</div>
            <div className="whitespace-pre-wrap rounded-lg border border-line bg-[#fafcfb] p-4 text-[13px] leading-relaxed">{finding.current || <span className="text-muted">— empty —</span>}</div>
            {sg && <div className="mt-2"><CharGauge n={finding.current.length} min={sg.min} max={sg.max} /></div>}
          </section>
        )}

        {finding.proposable && sg && (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <div className="field-label !mb-0">Suggested {sg.target === "meta_title" ? "meta title" : "meta description"} · editable</div>
              {proposal && <Badge tone={proposal.provenance === "simulated" ? "demo" : "live"}>{proposal.provenance === "simulated" ? "Simulated — not a model output" : `OpenAI · ${proposal.model}`}</Badge>}
            </div>
            {!proposal || proposal.status === "not_requested" || proposal.status === "rejected" ? (
              <div className="space-y-3 rounded-lg border border-dashed border-[#cfe0dc] p-4">
                {proposal?.status === "rejected" && <Note tone="warn">The previous suggestion was rejected. You can request a new one.</Note>}
                {live ? (
                  <>
                    <p className="text-xs leading-relaxed text-muted">Generates a suggestion with OpenAI (<code>{flags.model}</code>). Sent: the entry title, the current text and a short excerpt of the page body, never tokens or other entries.</p>
                    <p className="text-xs"><span className="font-semibold">Reasoning effort:</span> {flags.reasoningEffort ?? "model default"} <span className="text-muted">(set by OPENAI_REASONING_EFFORT; not editable here)</span></p>
                    {!flags.openaiConfigured && <Note tone="danger">OPENAI_API_KEY is not configured in .env.local.</Note>}
                    {!flags.aiTransferAllowed && <Note tone="danger">AI_SEND_CONTENT_TO_OPENAI=false: sending CMS content to OpenAI is disabled.</Note>}
                    <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" /><span>I confirm this entry&apos;s title, current text and excerpt may be sent to OpenAI&apos;s API.</span></label>
                  </>
                ) : <p className="text-xs leading-relaxed text-muted">Demo mode: the suggestion is <strong>simulated</strong> with simple text rules. No model is called.</p>}
                <Button variant="primary" disabled={!!busy || (live && (!consent || !flags.aiTransferAllowed || !flags.openaiConfigured))} onClick={() => run("generate", () => api("/api/seo/propose", "POST", { findingId: finding.id, consentToSendContent: consent }), live ? "Suggestion generated. Review before approving." : "Simulated suggestion created.")}>
                  {busy === "generate" ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {live ? "Generate with OpenAI" : "Generate simulated suggestion"}
                </Button>
              </div>
            ) : (
              <>
                <textarea value={text} onChange={(e) => setText(e.target.value)} onBlur={() => { if (dirty) void review("edit", "Edit saved to the audit trail."); }} disabled={!editable} aria-label="Editable suggestion" className="min-h-[96px] w-full resize-y rounded-lg border border-[#a2cec2] bg-[#fbfffd] p-3.5 text-[13px] leading-relaxed disabled:bg-[#f3f6f6]" />
                <div className="mt-2"><CharGauge n={text.length} min={sg.min} max={sg.max} /></div>
                {proposal.notes.map((n, i) => <p key={i} className="mt-1.5 text-[11px] text-muted">Note: {n}</p>)}
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg border border-line bg-[#fafcfb] p-3 text-[11px] sm:grid-cols-3">
                  {[["Model", proposal.model], ["Prompt", proposal.promptVersion], ["Reasoning effort", proposal.provenance === "openai" ? (proposal.reasoningEffort ?? "model default") : "n/a"], ["Input tokens", proposal.inputTokens?.toString() ?? "—"], ["Output tokens", proposal.outputTokens?.toString() ?? "—"], [proposal.actualUsd !== undefined ? "Cost (computed)" : "Cost", proposal.actualUsd !== undefined ? usd(proposal.actualUsd) : "not priced"]].map(([k, v]) => <div key={k}><dt className="text-[#8595a0]">{k}</dt><dd className="font-semibold">{v}</dd></div>)}
                </dl>
              </>
            )}
          </section>
        )}

        {!finding.proposable && <Note>This finding needs an editorial or schema change, so there is no automatic text suggestion. Use the guidance above.</Note>}
        {(error || info) && <div role={error ? "alert" : "status"}><Note tone={error ? "danger" : "info"}>{error ?? info}</Note></div>}

        <section aria-label="Audit trail">
          <div className="field-label">Audit trail</div>
          {audit.length === 0 ? <p className="text-xs text-muted">Detected by the audit. No review events yet.</p> : [...audit].reverse().map((e) => (
            <div key={e.id} className="flex gap-3 border-t border-line py-3 text-xs text-[#627b89]"><i className="mt-1.5 h-[9px] w-[9px] shrink-0 rounded-full bg-[#83bcb0]" /><div><strong className="block text-[#2e4655]">{e.action}</strong><span>{new Date(e.at).toLocaleString()} · {e.actorId} · {e.previousState} → {e.nextState}</span></div></div>
          ))}
        </section>
      </div>

      {proposal && finding.proposable && !["not_requested", "rejected"].includes(proposal.status) && (
        <div className="flex flex-wrap items-center gap-2.5 border-t border-line px-6 py-4">
          <Button variant="primary" disabled={!editable || !text.trim() || !!busy} onClick={() => review("approve", "Approved. No Contentstack write was performed.")}>{busy === "approve" ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Approve suggestion</Button>
          {mode === "demo" ? (
            <Button disabled={proposal.status !== "approved" || !!proposal.appliedToDemo || !!busy} onClick={() => run("apply", () => api("/api/translation/apply", "POST", { proposalId: proposal.id, target: "demo" }), "Applied to the demo dataset only. Scores recalculated.")}>{proposal.appliedToDemo ? "Applied to demo" : "Apply to demo dataset"}</Button>
          ) : (
            <Button disabled={proposal.status !== "approved"} onClick={async () => { await navigator.clipboard.writeText(proposal.editedText ?? proposal.suggestedText); setInfo("Approved text copied. Paste it into the field in Contentstack."); }}><Copy size={14} /> Copy approved text</Button>
          )}
          <Button variant="danger" disabled={!editable || !!busy} onClick={() => review("reject", "Rejected. The finding stays open.")}><X size={14} /> Reject</Button>
          <p className="w-full text-[10px] leading-snug text-muted">{mode === "demo" ? "Approval records a decision only. “Apply to demo” changes the local sample dataset." : "Approval records a decision only. Live write-back is not available for SEO suggestions; copy the text into Contentstack. Nothing is ever published by this tool."}</p>
        </div>
      )}
    </>
  );
}
