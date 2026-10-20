import { Badge } from "@/components/ui/badge";
import { Note } from "@/components/ui/card";
import { CsLink } from "@/components/ui/cs-link";
import { csLinks, type LinkBase } from "@/lib/domain/cs-links";
import type { Snapshot } from "@/lib/domain/types";

/** Always-visible statement of where the numbers on the page come from. */
export function Provenance({ snapshot, links }: { snapshot: Snapshot; links?: LinkBase | null }) {
  const live = snapshot.mode === "live";
  return (
    <div className="mb-5 space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-white px-4 py-3 text-[11px] text-muted">
        <Badge tone={live ? "live" : "demo"}>{snapshot.provenance}</Badge>
        <span>Stack: <strong className="text-text">{snapshot.stack}</strong> {links && <CsLink href={csLinks.dashboard(links)} label="Open stack dashboard" />}</span>
        <span>Region: <strong className="text-text">{snapshot.region}</strong></span>
        {snapshot.branch && <span>Branch: <strong className="text-text">{snapshot.branch}</strong></span>}
        <span>Master locale: <strong className="text-text">{snapshot.masterLocale}</strong> {links && <CsLink href={csLinks.languages(links)} label="Open language settings" />}</span>
        {snapshot.environment && <span>Environment: <strong className="text-text">{snapshot.environment}</strong></span>}
        <span>Entries scanned: <strong className="text-text">{snapshot.sourceEntryCount}</strong></span>
        <span>{live ? "Scanned" : "Generated"}: <strong className="text-text">{new Date(snapshot.completedAt).toLocaleString()}</strong></span>
      </div>
      {!live && <Note tone="warn">All figures on this page are computed from <strong>sample fixtures</strong>. Nothing here comes from Contentstack and no CMS write can happen in demo mode.</Note>}
      {snapshot.status === "partial" && (
        <Note tone="danger">
          <strong>Partial scan — coverage confidence reduced.</strong> {snapshot.errors.length} problem(s) occurred; affected items are excluded, never counted as complete.
          <ul className="mt-1 list-disc pl-5">
            {snapshot.errors.slice(0, 4).map((e, i) => <li key={i}>{e.scope}: {e.message}</li>)}
            {snapshot.errors.length > 4 && <li>…and {snapshot.errors.length - 4} more</li>}
          </ul>
        </Note>
      )}
      {snapshot.limits.length > 0 && <Note tone="warn">Scan limits applied: {snapshot.limits.join(" ")}</Note>}
    </div>
  );
}
