import { EmptyLive } from "@/components/kpi/empty-live";
import { Provenance } from "@/components/kpi/provenance";
import { ScanControl } from "@/components/kpi/scan-control";
import { GraphExplorer, type EntryIssues } from "@/components/graph/graph-explorer";
import { Card, PageHead } from "@/components/ui/card";
import { loadContext } from "@/lib/server/context";

export default async function GraphPage() {
  const { mode, view, liveConfigured, links } = await loadContext();
  const head = (
    <PageHead
      eyebrow="Reference Impact Graph"
      title="See what an edit can break."
      sub="Entries, the entries they reference, and the assets they use, from reference fields, JSON RTE embeds and file fields. Select a node to preview its blast radius before you change it."
      actions={mode === "live" ? <ScanControl label="Rescan references" variant="default" /> : undefined}
    />
  );
  if (!view) return <>{head}<EmptyLive configured={liveConfigured} /></>;
  const s = view.snapshot;
  if (!s.graph) {
    return (
      <>
        {head}
        <Provenance snapshot={s} links={links} />
        <Card className="mx-auto mt-6 max-w-xl p-8 text-center text-sm text-muted">This scan predates the reference graph. Run a new scan to build it.{mode === "live" && <div className="mt-4 flex justify-center"><ScanControl /></div>}</Card>
      </>
    );
  }

  // Open localization issues per entry, so the graph can show "this node is also a localization problem".
  const sevRank = { critical: 0, high: 1, medium: 2, low: 3 } as const;
  const issues: Record<string, EntryIssues> = {};
  for (const d of view.open) {
    const id = `${d.pointer.contentTypeUid}/${d.pointer.entryUid}`;
    const cur = (issues[id] ??= { open: 0, worst: d.severity, items: [] });
    cur.open++;
    if (sevRank[d.severity] < sevRank[cur.worst]) cur.worst = d.severity;
    if (cur.items.length < 6) cur.items.push({ id: d.id, label: d.fieldLabel, locale: d.pointer.locale, severity: d.severity });
  }

  return (
    <>
      {head}
      <Provenance snapshot={s} links={links} />
      <GraphExplorer graph={s.graph} issues={issues} links={links} masterLocale={s.masterLocale} mode={mode} />
    </>
  );
}
