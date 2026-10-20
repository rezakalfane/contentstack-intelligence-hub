import { EmptyLive } from "@/components/kpi/empty-live";
import { Provenance } from "@/components/kpi/provenance";
import { ScanControl } from "@/components/kpi/scan-control";
import { LocalizationWorkspace } from "@/components/localization/workspace";
import { PageHead } from "@/components/ui/card";
import { loadContext } from "@/lib/server/context";

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined, d = "") => (Array.isArray(v) ? v[0] : v) ?? d;

export default async function LocalizationPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { mode, view, audit, status, liveConfigured, links } = await loadContext();
  const head = (
    <PageHead
      eyebrow="LocaleOps · Localization intelligence"
      title="Every market. Every field. One view."
      sub="Missing, incomplete, possibly stale and unpublished content, each tracked separately. Review proposals safely: approval is a decision, never a CMS write."
      actions={mode === "live" ? <ScanControl label="Sync Contentstack" /> : undefined}
    />
  );
  if (!view) return <>{head}<EmptyLive configured={liveConfigured} /></>;
  const s = view.snapshot;
  const targets = s.locales.filter((l) => l.code !== s.masterLocale);

  return (
    <>
      {head}
      <Provenance snapshot={s} links={links} />
      <LocalizationWorkspace
        mode={mode}
        provenance={s.provenance}
        masterLocale={s.masterLocale}
        locales={targets.map((l) => ({ code: l.code, name: l.name }))}
        contentTypes={s.contentTypes.map((c) => ({ uid: c.uid, title: c.title }))}
        matrix={view.kpis.matrix}
        links={links}
        diagnostics={view.diagnostics}
        proposals={view.proposals}
        audit={audit}
        flags={{
          aiTransferAllowed: status.openai.contentTransferAllowed,
          openaiConfigured: status.openai.configured,
          model: status.openai.model,
          reasoningEffort: status.openai.reasoningEffort,
          writesEnabled: status.writes.enabled,
          writeTokenConfigured: status.writes.writeTokenConfigured,
          writeAllowedEntryUids: status.writes.allowedEntryUids,
          masterLocale: s.masterLocale,
        }}
        initial={{ q: one(sp.q), locale: one(sp.locale, "all"), type: one(sp.type, "all"), status: one(sp.status, "open"), issue: one(sp.issue) }}
      />
    </>
  );
}
