import { Shell } from "@/components/layout/shell";
import { loadContext } from "@/lib/server/context";
import { DEMO_PROVENANCE, LIVE_PROVENANCE } from "@/lib/server/data";
import { relativeTime } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function ProductLayout({ children }: { children: React.ReactNode }) {
  const { mode, view, liveConfigured, renderedAt } = await loadContext();
  const freshness = view
    ? mode === "demo"
      ? "Sample fixtures · no network"
      : `Scanned ${relativeTime(view.snapshot.completedAt, renderedAt)}${view.snapshot.status === "partial" ? " · partial" : ""}`
    : "No scan yet";
  return (
    <Shell
      mode={mode}
      liveConfigured={liveConfigured}
      provenance={mode === "live" ? LIVE_PROVENANCE : DEMO_PROVENANCE}
      stackLabel={mode === "live" ? `${view?.snapshot.region?.toUpperCase() ?? "EU"} · ${view?.snapshot.branch ?? "main"}` : "Global commerce (sample)"}
      freshness={freshness}
    >
      {children}
    </Shell>
  );
}
