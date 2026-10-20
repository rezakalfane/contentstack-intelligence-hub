import { DiagnosePanel } from "@/components/kpi/diagnose-panel";
import { Badge } from "@/components/ui/badge";
import { CsLink } from "@/components/ui/cs-link";
import { csLinks } from "@/lib/domain/cs-links";
import { Card, Note, PageHead, SectionTitle } from "@/components/ui/card";
import { EXCLUSION_POLICY_NOTE } from "@/lib/domain/normalizer";
import { loadContext } from "@/lib/server/context";

const Row = ({ k, v, tone }: { k: string; v: string; tone?: "live" | "critical" | "neutral" | "demo" }) => (
  <div className="flex items-center justify-between gap-4 border-t border-[#eef1f3] py-2.5 text-xs first:border-0">
    <span className="text-muted">{k}</span>
    {tone ? <Badge tone={tone}>{v}</Badge> : <span className="font-semibold">{v}</span>}
  </div>
);

export default async function SettingsPage() {
  const { status, view, mode, links } = await loadContext();
  const cs = status.contentstack;
  return (
    <>
      <PageHead eyebrow="System · Integration" title="Built for live. Safe by default." sub="Read-only integration status. Secrets live in .env.local and are never displayed, serialized to the browser or logged." />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-5">
          <SectionTitle title="Contentstack (read-only)" hint="Content Management API, called server-side only" />
          <Row k="Credentials" v={cs.configured ? "Configured" : "Missing"} tone={cs.configured ? "live" : "critical"} />
          <Row k="Region" v={cs.region ?? "invalid"} />
          <Row k="Branch" v={cs.branch} />
          {links && (
            <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-[#eef1f3] py-2.5">
              <CsLink href={csLinks.dashboard(links)} label="Open stack dashboard">Stack dashboard</CsLink>
              <CsLink href={csLinks.languages(links)} label="Open language settings">Language settings</CsLink>
            </div>
          )}
          <Row k="Environment (publication checks)" v={cs.environment ?? "not set"} />
          {cs.configError && <Note tone="danger">{cs.configError}</Note>}
          <div className="mt-4"><DiagnosePanel /></div>
        </Card>
        <Card className="p-5">
          <SectionTitle title="OpenAI proposals" hint="Responses API, server-side only, structured output validated with Zod" />
          <Row k="API key" v={status.openai.configured ? "Configured" : "Missing"} tone={status.openai.configured ? "live" : "critical"} />
          <Row k="Model (OPENAI_MODEL)" v={status.openai.model} />
          <Row k="Reasoning effort" v={status.openai.reasoningEffort ?? "not set (model default)"} />
          <Row k="Content transfer to OpenAI" v={status.openai.contentTransferAllowed ? "Allowed + per-field consent" : "Disabled"} tone={status.openai.contentTransferAllowed ? "live" : "neutral"} />
          <Row k="Cost pricing configured" v={status.openai.priced ? "Yes" : "No — cost shown as “—”"} />
          <div className="mt-3"><Note>Model availability is verified at runtime with “Check OpenAI model access”. The app never silently substitutes a model or assumes a price.</Note></div>
        </Card>
        <Card className="p-5">
          <SectionTitle title="Write safety" hint="Approval is not a CMS write; publishing does not exist in this build" />
          <Row k="ENABLE_CMS_WRITES" v={status.writes.enabled ? "true" : "false (default)"} tone={status.writes.enabled ? "critical" : "live"} />
          <Row k="Separate write token" v={status.writes.writeTokenConfigured ? "Configured" : "Not configured"} />
          <Row k="Publishing" v="Not implemented" tone="live" />
          <div className="mt-3"><Note>Guarded writer: allowlisted test entries only · explicit confirmation · fresh source/target re-read with fingerprint and version checks (409 on conflict) · single-field merge · read-back verification · draft only. A pre-read is not an atomic compare-and-swap. This path is unit-tested against mocks and has not been run against a live stack.</Note></div>
        </Card>
        <Card className="p-5">
          <SectionTitle title="Dataset & policy" hint={`Currently viewing: ${mode === "live" ? "LIVE · Contentstack" : "DEMO · Sample fixtures"}`} />
          {view ? (
            <>
              <Row k="Master locale" v={view.snapshot.masterLocale} />
              <Row k="Target locales" v={view.snapshot.locales.filter((l) => l.code !== view.snapshot.masterLocale).map((l) => l.code).join(", ") || "none"} />
              <Row k="Critical markets (priority ×1.5)" v={view.snapshot.policy.criticalLocales.join(", ") || "none configured"} />
              <Row k="Source entries scanned" v={String(view.snapshot.sourceEntryCount)} />
              <Row k="Scan status" v={view.snapshot.status} tone={view.snapshot.status === "complete" ? "live" : "critical"} />
            </>
          ) : <p className="text-xs text-muted">No dataset loaded in this mode yet.</p>}
          <div className="mt-3"><Note>{EXCLUSION_POLICY_NOTE}</Note></div>
        </Card>
      </div>
    </>
  );
}
