"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { CsLink } from "@/components/ui/cs-link";
import { csLinks, type LinkBase } from "@/lib/domain/cs-links";
import type { LocalizationDiagnostic, Severity } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";
import { RULE_TITLES, SEVERITY_TONE, STATUS_LABEL } from "@/components/localization/labels";

const REMEDIATION: Record<string, string> = {
  "LOC-001": "Generate a proposal, review it, then update the localized entry in Contentstack.",
  "LOC-002": "Review the field. Translate it, or confirm it is intentionally identical (e.g. a product name).",
  "LOC-003": "Compare the updated source with the approved baseline and re-review.",
  "LOC-004": "Restore the original placeholders/markup in the target text.",
  "PUB-001": "Use the existing Contentstack publishing workflow. This tool never publishes.",
};

export function HealthTable({ issues, initialRule, links, masterLocale }: { issues: LocalizationDiagnostic[]; initialRule: string; links: LinkBase | null; masterLocale: string }) {
  const [sev, setSev] = useState<Severity | "all">("all");
  const [rule, setRule] = useState(initialRule);
  const rows = useMemo(() => issues.filter((d) => (sev === "all" || d.severity === sev) && (rule === "all" || d.ruleIds.includes(rule))), [issues, sev, rule]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Severity filter">
        {(["all", "critical", "high", "medium", "low"] as const).map((s) => (
          <button key={s} aria-pressed={sev === s} onClick={() => setSev(s)} className={cn("rounded-full border px-3 py-1.5 text-[11px] font-bold capitalize", sev === s ? "border-accent bg-accent text-white" : "border-line bg-white text-[#46606f] hover:bg-canvas")}>{s}</button>
        ))}
        <select value={rule} onChange={(e) => setRule(e.target.value)} aria-label="Rule filter" className="ml-auto min-h-[34px] rounded-lg border border-[#d8e2e7] bg-white px-2.5 text-xs">
          <option value="all">All rules</option>
          {Object.entries(RULE_TITLES).map(([id, t]) => <option key={id} value={id}>{id} · {t}</option>)}
        </select>
      </div>
      <p className="mb-2 text-[11px] text-muted" role="status">{rows.length} finding(s){rows.length > 60 ? " — showing the first 60" : ""}</p>
      <ul className="divide-y divide-[#eef1f3] rounded-lg border border-line">
        {rows.slice(0, 60).map((d) => (
          <li key={d.id}>
            <details className="group">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-4 py-3 text-xs hover:bg-[#f5faf9]">
                <Badge tone={SEVERITY_TONE[d.severity]}>{d.severity}</Badge>
                <span className="font-bold text-[#1d3542]">{d.title}</span>
                <span className="text-muted">{d.fieldLabel}</span>
                <span className="ml-auto flex items-center gap-2 text-muted">{d.pointer.locale.toUpperCase()} · {STATUS_LABEL[d.status]} · {d.ruleIds.join(", ")}</span>
              </summary>
              <div className="space-y-2 bg-[#fafcfb] px-4 py-3 text-[11px] text-[#46606f]">
                <p><strong>Rule:</strong> {d.ruleIds.map((r) => `${r} ${RULE_TITLES[r]}`).join(" · ")}</p>
                <ul className="list-disc pl-5">{d.evidence.map((e, i) => <li key={i}>{e}</li>)}</ul>
                <p><strong>Remediation:</strong> {REMEDIATION[d.ruleIds[0] ?? "LOC-001"]}</p>
                <p><strong>Affected:</strong> {d.contentTypeTitle} · entry {d.pointer.entryUid} · market {d.pointer.locale}{d.campaignId ? ` · campaign ${d.campaignId}` : ""}</p>
                <div className="flex flex-wrap items-center gap-4">
                  <Link className="font-bold text-accent hover:underline" href={`/localization?issue=${d.id}`}>Open review →</Link>
                  {links && <CsLink href={csLinks.entry(links, d.pointer.contentTypeUid, d.pointer.locale, d.pointer.entryUid)} label={`Open ${d.pointer.locale} entry in Contentstack`}>Open {d.pointer.locale} entry</CsLink>}
                  {links && <CsLink href={csLinks.entry(links, d.pointer.contentTypeUid, masterLocale, d.pointer.entryUid)} label="Open source entry in Contentstack">Open source entry</CsLink>}
                </div>
              </div>
            </details>
          </li>
        ))}
        {rows.length === 0 && <li className="px-4 py-8 text-center text-xs text-muted">No findings match the filters.</li>}
      </ul>
    </div>
  );
}
