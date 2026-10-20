# Contentstack Intelligence Hub — Claude Code Implementation Handoff

**Version:** 1.1 · Live-first credential-aware revision · **Prepared:** 20 October 2026 · **Target presentation:** 21 October 2026  
**Product category:** Headless CMS content operations intelligence  
**Purpose:** A credible, interactive job-interview prototype using **actual Contentstack data and real OpenAI proposals** wherever access permits, with fixture fallback and a safe production architecture.  
**Target stack:** Next.js (App Router), TypeScript (strict), Tailwind CSS, shadcn/ui, Recharts, TanStack Table, Zod.  
**Demo reference:** `demo/index.html` (standalone, offline, zero dependencies). **Live setup:** `LIVE_INTEGRATION.md` and `.env.example`.  
**Implementation owner:** Claude Code. **Scope:** Product demo with explicit, safe API boundaries; no unreviewed CMS writes.

---

## 0. Instructions to Claude Code (READ FIRST)

You are implementing a product demonstration, **not** pretending to have shipped an enterprise-grade CMS integration.

1. Inspect this repository. Read `README.md`, `CLAUDE_HANDOFF.md`, `LIVE_INTEGRATION.md`, `.env.example` and `demo/index.html` before editing any files. Preserve existing code and only scaffold a new project when the repository is empty or appropriate.
2. Create a short `PLAN.md` with architecture, routes, acceptance criteria, and exact first tasks. Then implement without waiting for a lengthy design debate.
3. Match the standalone HTML visual direction **closely** but rebuild using accessible React components, not iframe embedding or copy/pasting one giant component.
4. **Credentials are available.** Prioritize a read-only **LIVE Contentstack scan** and **real OpenAI proposal** as the main technical proof. Keep an independent, polished fixture-backed demo mode so the interview never depends on availability or tenant permissions. Live CMS writes remain separately authorized and disabled by default.
5. Never claim mock API actions are live. Clearly label sample data and simulated transitions across UI and README.
6. Don't auto-publish, overwrite production content, create risky mutations, or leak credentials. Protect approvals with explicit user intent and current-version rechecks.
7. Test the data analysis and state transitions; finish by running lint, typecheck, unit tests and build. Report truthful results and any incomplete work.
8. Prioritize a demonstrable end-to-end flow over adding breadth without depth.

**Launch sequence for interview:** If live connection succeeds: Contentstack connection → real market scan → actual localization issue → live OpenAI proposal → edit → approve (no CMS write). If safe sandbox writing is separately configured, demonstrate guarded draft update + read-back. If access is blocked: use offline fallback Overview → Italy gap → local review → apply to demo → KPIs recalculate. Label provenance throughout.

---

## 1. The problem / product positioning

### Problem statement

Teams running global commerce and marketing experiences often cannot answer quickly:

- Which localized entries or **individual translatable fields** are missing or incomplete?
- Which localizations might be stale **because the source changed since translation approval**?
- Which issues jeopardize a campaign launch or affect important pages?
- Which AI suggestions are ready for human review, and how much did they cost?
- What has been *proposed*, *approved*, *written to the CMS*, or *published*? These are different states.

### Thesis

**A cross-market operational control plane that detects, explains, prioritizes, and helps resolve CMS content risks.** It supplements native Contentstack capabilities instead of replicating them. Future integrations connect CMS data to GA4 and BigCommerce to prioritize issues by business impact.

### Interview pitch

> I compared four enterprise headless CMS platforms and saw that AI generation, workflows, localization and usage dashboards already exist. So I focused on the less glamorous but highly valuable layer: detecting content issues across markets, estimating their business impact, and making AI fixes reviewable and measurable. The result is a modular Contentstack Intelligence Hub, built with Next.js, TypeScript and an adapter-based integration architecture.

### Definition of success

A hiring manager can watch a **three-minute** demo and see product judgment, clean frontend engineering, pragmatic APIs, human-in-the-loop AI, cautious write safety, and a credible growth roadmap.

---

## 2. Competitive research: avoid claiming native features are absent

These are public-doc-based observations as of 20 October 2026, not an exhaustive feature certification; availability can vary by plan, configuration and region.

| Area | Contentstack | Contentful | Storyblok | Amplience | Our differentiation |
|---|---|---|---|---|---|
| Native AI | Agent OS, Polaris, Automations, agents | AI Actions | AI assistance, including translations and SEO | Workforce AI / Flows | Unified operational diagnosis + auditable outcomes |
| Translation workflows | Localization and partner/automation options | AI Actions translate entries/fields | AI Translations (Labs/beta in documentation) | Workforce translation flows | Cross-locale field coverage and provenance-aware freshness |
| Content analytics | CMS usage, lifecycle, workflow and team activity analytics | Vendor-specific analytics and apps | Platform and ecosystem tools | Workforce workflow monitoring | Custom score explaining *what to fix next* |
| Human approval | Existing editorial workflow and AI governance | Editor review of AI results | Review before accepting translated content | Human review steps | Traceable proposal → decision → CMS update chain |
| Commerce alignment | Integrations available | Integrations available | Integrations available | Deep commerce-oriented workflows | Join CMS issues to actual pages/products and optional GA4/BigCommerce impact |
| Custom UI apps | App SDK Dashboard / Full Page / Global Full Page | App framework | Plugins/apps | Extensions/integrations | Independently deployable Next.js UI, optionally embeddable |

**Claims to avoid:** "Contentstack has no AI", "Contentstack has no analytics", "Contentstack cannot translate", "Contentful is the only CMS with approvals", or "Amplience has no workflow dashboard". These are contradicted by vendor documentation.

**Confidence label:** Ideas below are **extension opportunities**, not verified missing built-in features. Verify exact plan and deployment behavior on the employer's Contentstack tenant before making definitive statements.

Official references and integration docs are in §19.

---

## 3. Ranked opportunities / 10-module roadmap

Scoring: Interview appeal (1–5), end-user value (1–5), prototype effort (S/M/L). These rankings are product judgments, not measured market data.

| # | Module | Interview | Value | Effort | Phase | Unique result |
|---|---|---:|---:|---|---|---|
| 1 | **LocaleOps — localization command center** | 5 | 5 | M | P0 | Locale × content/field gap matrix, reviewable AI fixes |
| 2 | **Content Health Radar** | 5 | 5 | S/M | P0 | Transparent rules, actionable risk list, drill-down |
| 3 | Content-to-Commerce Intelligence | 5 | 5 | L | P2 | Prioritize by real page/SKU impact, not guesses |
| 4 | Campaign Release Guardian | 4 | 5 | M/L | P1 | Aggregate readiness across regions/dependencies |
| 5 | Reference Impact Graph | 4 | 4 | M/L | P2 | Preview blast radius before content edits |
| 6 | SEO/AI discoverability audit | 4 | 4 | M | P1 | Field quality audit + human-reviewed improvements |
| 7 | Multi-market consistency monitor | 4 | 4 | M/L | P2 | Detect inconsistent claims, offers, disclaimers |
| 8 | Editorial bottleneck predictor | 3 | 4 | L | P3 | Forecast delay risk, beyond descriptive reports |
| 9 | Schema governance | 4 | 4 | M | P2 | Complexity, redundancy, change-risk recommendations |
| 10 | AI Operations ROI | 4 | 4 | M | P1/P2 | Accepted outputs, costs, rework, throughput |

For tomorrow: deliver **one product with three strong pages and one real end-to-end demo interaction**. Treat items 3–10 as roadmap cards unless already implemented.

---

## 4. Demo UX & design system

### Reference assets

`demo/index.html` is a self-contained clickable visual and behavior reference (no live API, no remote libraries). Use it to see hierarchy, colors, interaction, and illustrative content.

**Direction:** B2B SaaS; editorial precision and operational confidence. Do not build a generic chat assistant.

- Slate / ink sidebar (`#131c27`), warm near-white canvas (`#f6f8f9`), white raised cards, teal action (`#08796d`), amber warnings (`#d48a36`), red critical state (`#b94b46`).
- Typeface: system UI / Inter if locally available; no external font dependency required.
- Sidebar navigation: Overview, Localization, Content health, Insights, Roadmap; secondary Activity and Settings (functional or mark "planned").
- Top bar: stack selector, global search, freshness indicator and DEMO label.
- Clear hierarchies: KPI tiles → coverage → priority queue → review drawer.
- Accessible keyboard navigation, focus rings, non-color-only status labels, mobile responsive collapsible navigation.
- Use icons consistently (Lucide React in Next.js).
- All KPI values derive from loaded records and policy; **never hardcode metrics independently of fixtures**.

### Required routes and states

**`/overview`**: top-level health, locale coverage, open blockers, pending review, coverage bars, trend (illustrative trend labeled if fixtures), prioritized issues, "View all" links. Display `LIVE · Contentstack` versus `DEMO · Sample fixtures`, the selected region/stack/branch and latest scan time prominently.

**`/localization`**: market × content-type matrix with a legend and percentages; language selection, content-type filter, issue status filter, search, sorting, CSV export; clickable issue table; bulk *propose* action can be mocked but must not auto-approve.

**`/localization/review/[issueId]`** or accessible side drawer: source locale and field path, source content, current target, proposed target, model/temperature or effort info, estimated tokens/cost, glossary/placeholder warnings, editable proposal, approve/reject/revise buttons, audit trail. After approval, *apply to demo* is distinct from approval; live CMS write explicitly disabled unless configured and authorized.

**`/health`**: rule-based issues, score breakdown, severity filter, recommended remediation, affected pages/markets, rule explanations.

**`/insights`**: coverage breakdown and quality trends; P2 GA4/commerce connector stub clearly marked as future integration, never fake measured revenue.

**`/roadmap`**: product modules, effort/impact, native-overlap annotation, and boundaries.

**Optional `settings`**: model, locale policy, read-only integration status, AI cost settings, and stack details; no secret echoing.

### Three-minute live demo script

00:00–00:30 — Summary KPIs, label sample dataset, explain what is actionable.  
00:30–01:00 — Click Italy; filter "missing" and identify a campaign field.  
01:00–02:00 — Open review drawer; show original, target, proposal; edit a phrase; approve.  
02:00–02:30 — Point out that *approval is not a CMS write*; choose explicit "Apply to demo" if desired.  
02:30–03:00 — Return to adjusted local metrics; show architecture/roadmap and safe integration boundary.

---

## 5. Domain model / status semantics

**Avoid the common mistake of conflating localization existence, field completeness, publication and AI review.** Model these orthogonally.

```ts
type LocaleCode = string; // e.g. "en-us", "fr-fr"; preserve vendor codes

type LocalizationExistence =
  | "exists" | "fallback_only" | "not_localized" | "unknown";

type FieldCompleteness = "complete" | "incomplete" | "missing" | "not_applicable";
type Freshness = "current" | "stale" | "unknown";
type Publication = "published" | "draft" | "unpublished" | "unknown";

type ProposalState =
  | "not_requested" | "generating" | "proposed"
  | "in_review" | "approved" | "rejected"
  | "write_pending" | "written" | "write_failed";

interface ContentPointer {
  stackId: string;
  branch?: string;
  contentTypeUid: string;
  entryUid: string;
  locale: LocaleCode;
  fieldPath: string; // stable typed path incl. modular-block instance IDs
}

interface LocalizationDiagnostic {
  id: string;
  pointer: ContentPointer;
  title: string;
  campaignId?: string;
  existence: LocalizationExistence;
  completeness: FieldCompleteness;
  freshness: Freshness;
  publication: Publication;
  sourceUpdatedAt?: string;
  translationReviewedAt?: string;
  sourceFingerprint?: string;
  approvedSourceFingerprint?: string;
  severity: "critical" | "high" | "medium" | "low";
  ruleIds: string[];
  evidence: string[];
}

interface TranslationProposal {
  id: string;
  issueId: string;
  status: ProposalState;
  sourceText: string;
  existingText?: string;
  suggestedText: string;
  editedText?: string;
  model: string;
  promptVersion: string;
  glossaryVersion?: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedUsd?: number;
  actualUsd?: number;
  sourceFingerprint: string;
  cmsVersionAtProposal?: number;
  reviewedBy?: string;
  reviewedAt?: string;
  updatedAt: string;
}
```

**Key identity:** `(stack, branch, content type, entry UID, locale, field path)` identifies the field version under review. Content fields may be nested in Groups, Global Fields, Modular Blocks, and Rich Text JSON; field path construction must include a stable identifier for repeated instances, not just an array index where reorder is possible.

---

## 6. Real Contentstack integration plan

### API responsibilities

Use **Content Management API (CMA)** to inspect schemas, all entries (including drafts), configured locales, localization existence, entry versions, and publishing details. Content Delivery API (CDA) returns published delivery-facing content and may use fallback, so it is **not** sufficient to measure true localization completeness.

Suggested verified endpoints (check region/base URL and tenant authorization):

| Purpose | Method/path | Note |
|---|---|---|
| Content types | `GET /v3/content_types` | Paginate; request global schemas if applicable |
| Entries of a type | `GET /v3/content_types/{ct}/entries` | Paginate; use locale query and metadata only as supported |
| Specific entry | `GET /v3/content_types/{ct}/entries/{uid}?locale={code}` | For full current snapshot/version |
| Explicit locales for entry | `GET /v3/content_types/{ct}/entries/{uid}/locales` | Distinguish localized vs inherited content |
| Localized update | `PUT /v3/content_types/{ct}/entries/{uid}?locale={code}` | **Only approved, authorized, guarded writes** |

Source: https://www.contentstack.com/docs/developers/apis/content-management-api/entries and https://www.contentstack.com/docs/developers/apis/content-management-api/content-types

**Important:** The vendor describes certain update/localize operations with the same endpoint. Always inspect whether a localized entry exists, check valid request shape and preserving non-localizable nested-field metadata before implementing a write. Do not infer safe payload structure from a demo fixture.

Use official JS Management SDK (`@contentstack/management`) if it makes auth/region/pagination easier, or a thin typed fetch adapter; document the decision. If using HTTP directly, keep credentials exclusively in a server module. Distinguish regional hosts, branches, locale codes and multi-stack access. Consider OAuth scoped permissions for a distributable app; use read-only management tokens for a private prototype where appropriate.

### Read-only sync algorithm

1. Retrieve locales and default/fallback configuration; define the list of markets in scope.
2. Retrieve content types and recursively normalize schema field definitions, including `mandatory`, `non_localizable`, data type, nested Groups / Global Fields / Modular Blocks / JSON RTE.
3. Paginate source entries by type. Limit concurrency; retry transient 429/5xx with backoff/jitter; respect API quotas.
4. For each source entry, request explicit list of localized versions and inspect the target versions independently, without delivery fallback. Preserve optional publishing details separately.
5. For each localizable field, calculate field completeness with schema-aware rules; preserve intentional blanks and market exclusions when configured.
6. Compare source fingerprints *only against previously approved fingerprints* to derive freshness. If no approval baseline exists, status is `unknown`, not automatically stale.
7. Persist normalized results and timestamp of sync, partial failures, and cursor/checkpoint; never silently interpret an incomplete scan as 100% completeness.
8. Expose sync age and coverage confidence in UI. Support manual refresh in P1, background sync in P2.

### Live write protocol (separate authorized milestone after the live read + AI P0)

1. Reviewer explicitly approves a proposed field change.
2. Require write-enabled environment, authenticated actor and precise scope, including stack/locale/entry/field and preview of update.
3. Re-read current localized entry and schema; verify current source fingerprint and entry version (optimistic conflict protection), plus review actor permissions.
4. Merge **only** allowed translatable fields into current entry preserving unrelated content, references, nested `_metadata.uid`, and non-localizable content behavior. No blind whole-entry overwrite.
5. Support idempotency key and audit event; write via CMA; verify read-back of updated field and update proposal state to `written` only after success.
6. Do **not** publish automatically. If a publishing step is ever added, use a separate explicit permission, environment, locale and confirmation boundary.
7. On version conflict return actionable `409`/"re-review required" rather than reusing a stale proposal.

### Adapter contracts

```ts
export interface ContentstackAdapter {
  kind: "demo" | "live";
  getContext(): Promise<{stack: string; branch?: string; masterLocale: string; locales: string[]}>;
  listContentTypes(): Promise<NormalizedContentType[]>;
  listSourceEntries(input: {contentTypeUid: string; cursor?: string}): Promise<Page<NormalizedEntry>>;
  getLocalePresence(input: {contentTypeUid: string; entryUid: string}): Promise<string[]>;
  getLocalizedEntry(input: ContentPointer): Promise<NormalizedEntry | null>;
  getPublicationState(input: ContentPointer): Promise<Publication>;
  // Exposed only from separate authorized writer, never generic read adapter:
}
export interface ReviewedContentWriter {
  applyReviewedProposal(input: {proposalId: string; actorId: string; confirm: true}): Promise<WriteResult>;
}
```

### Embedding strategy

P0 runs as a standalone Next.js dashboard. Later use **Contentstack App SDK** Full Page (stack) or Global Full Page (organization) for embedded dashboard integration if the employer's plan and permissions permit. These locations are already supported and do not need to be invented.

---

## 7. Scoring and analytics: exact formulas

A product-quality metric must be reproducible, transparent, and scoped to the sampled dataset. Do not make unverified claims about conversion lift or revenue.

### Locale coverage

For a specific locale or content type:

```
eligible = count(source entry × translatable required field in market scope)
complete = count(eligible fields with explicit localized, nonempty valid value)
coverage% = 100 * complete / eligible
```

If `eligible = 0`, display **N/A** (not 100%). If an entry has intentionally excluded markets, exclude only by explicit policy and disclose the exclusion. Source locale coverage can be 100% only when it satisfies its own applicable rules. For the simplified demo, use an entry-locale coverage metric and label it clearly; P1 moves to field-level.

### Health score

Each finding has a weight (critical 5, high 3, medium 2, low 1). Show counts and explanations. Example *illustrative* quality score:

```
healthScore = round(100 * max(0, 1 - weightedFindings / (5 * eligibleUnits)))
```

Clamping applies between 0 and 100. This is a relative rules-based heuristic, **not** a statistically validated grade. Display how it is calculated and do not present precision beyond its meaningful scope.

### Release readiness

A release is blocked when explicit **blocking rules** fail, such as a required campaign locale absent, campaign dependency unavailable in target environment, or mandatory review incomplete. Readiness score can be descriptive, but **never** replace explicit blockers with a single arbitrary percentage.

### Priority

For real connected data:

```
priority = severityFactor × criticalMarketFactor × exposureFactor × deadlineFactor
```

For demo use categorical rules and show rationale; do not simulate analytics as actual revenue. GA4 / BigCommerce joins require authoritative page URL/SKU mapping and real permissions.

### AI ROI

```
proposal acceptance rate = approved / (approved + rejected)
AI cost per accepted translation = sum(actual model cost) / approved
review throughput = reviewed proposals / time period
```

If actual API usage is unavailable, call costs **estimated** and acceptance counts **demo**.

---

## 8. Translation design & validation

### Model strategy

Configure `OPENAI_MODEL` (suggested candidate `gpt-6-luna`, if actually accessible via the connected OpenAI API/account); **do not hardcode assumed availability or pricing**. Use `reasoning.effort: low` only if supported by the selected model. Store the model name, prompt version, token usage and actual/estimated cost in the proposal record. Fail closed with an actionable error if model access is unavailable; demo mode uses canned proposals that are explicitly **simulated**, not labeled as generated live.

### Prompt inputs

- Source locale and text, target locale with regional conventions.
- Content type, field purpose, page/campaign context, optional character limit.
- Approved brand terminology, legal terms and do-not-translate tokens.
- Existing translation (if any), approved translations from adjacent fields when permitted.
- Fixed placeholders such as `{{firstName}}`, `{sku}`, `%s`, Markdown links, JSON structure.

### Model output

Validate with Zod: `{ translatedText, glossaryWarnings[], placeholderWarnings[], notes[], confidenceLabel? }`. Do not report a numeric translation-confidence percentage unsupported by calibration. Escaping, Unicode and rich-text must preserve structure.

### Guardrails

- Never send private tokens, auth headers, customer PII or private internal data to an AI provider without organizational approval.
- For structured rich text: extract localizable text leaves with stable paths, translate leaves, validate the original tree's immutable shape and tokens, then reconstruct; do not ask model to invent an entire Contentstack JSON RTE value.
- Detect placeholder mismatch, HTML/Markdown markup changes, brand terminology violation, locale formatting errors and suspicious hallucinations. Flag for human review; no auto-approve.
- Batch generation must have a dry-run preview, budget ceiling, concurrency limit, cancellation and idempotency.
- Human review must identify the actor and timestamp; audit state transitions.

---

## 9. Database / persistence plan

**P0:** real Contentstack read-only inventory + real OpenAI proposals if credentials authorize; deterministic TypeScript fixture fallback with local review state. Never combine live metrics with demo fixtures without explicitly labeling provenance.  
**P1:** Postgres + Drizzle (or Prisma, choose one) for audits and review proposals; retain immutable source snapshots or hashes, not arbitrary sensitive content, according to retention policy.

Suggested relational tables:

- `cms_connections(id, tenant_key, region, stack_uid, branch, auth_ref, read_only, last_sync_at)`
- `content_types(id, connection_id, uid, schema_version_hash, schema_json, fetched_at)`
- `content_entries(id, connection_id, content_type_uid, entry_uid, locale, version, updated_at, publication_json, fetched_at)`
- `field_snapshots(id, entry_id, field_path, value_hash, source_fingerprint, completeness, captured_at)`
- `diagnostics(id, pointer_hash, rule_uid, evidence_json, severity, state, discovered_at, resolved_at)`
- `translation_proposals(id, diagnostic_id, model, prompt_version, source_fingerprint, target_text, state, token_usage_json, estimated_cost, actual_cost, proposed_at)`
- `review_events(id, proposal_id, actor_id, action, previous_state, next_state, comments, at)`
- `write_attempts(id, proposal_id, idempotency_key, expected_entry_version, actual_entry_version, state, error_code, at)`
- `sync_runs(id, connection_id, started_at, completed_at, status, counters_json, errors_json)`

Unique constraints on diagnostic pointer+rule, entry identity, and write idempotency key. No sensitive tokens in JSON exports, logs or frontend state.

---

## 10. App file architecture

```text
app/
  (product)/
    layout.tsx
    overview/page.tsx
    localization/page.tsx
    localization/review/[id]/page.tsx
    health/page.tsx
    insights/page.tsx
    roadmap/page.tsx
  api/
    demo/reset/route.ts               # if server demo store is used
    sync/route.ts                     # read-only, authenticated P0
    translation/propose/route.ts      # real AI P0 when authorized
    translation/review/route.ts       # approval action
    translation/apply/route.ts        # live writes disabled by default
components/
  layout/{sidebar,topbar}.tsx
  kpi/{metric-card,coverage-bars}.tsx
  localization/{locale-matrix,issue-table,review-panel}.tsx
  health/{health-score,health-table}.tsx
  ui/...
lib/
  domain/{types,rules,scoring,fingerprint,normalizer}.ts
  adapters/{contentstack-adapter,demo-adapter,live-adapter}.ts
  ai/{translator,provider,validation,pricing}.ts
  security/{auth,permissions,write-policy}.ts
  demo/{seed,fixtures}.ts
  observability/{audit,usage}.ts
  utils/...
tests/{scoring,localization,translation-review,concurrency}.test.ts
public/...
README.md
.env.example
```

Use React server components for data-loading page shells, client components for filters and review. Server-side credentials exclusively in the adapter/API route. Do not create React state that doubles as an undisclosed independent source of truth once persistence is introduced.

---

## 11. Acceptance criteria (interview MVP P0: connected first, fixture fallback)

- [ ] `npm install && npm run dev` starts and navigates among real app routes.
- [ ] Overview and Localization visually match the mockup's information hierarchy.
- [ ] There is useful fixture data across **at least five locales, four content types, and 50 entries**.
- [ ] KPI/matrix/issue counts are computed from fixture data; filtering and sorting work.
- [ ] Selecting an Italian missing-translation issue opens a contextual review screen.
- [ ] AI proposal in **demo mode** is explicitly simulated; editable; placeholder check warnings visible.
- [ ] Approve and reject are separate transitions with audit events; no mutation happens on approval.
- [ ] "Apply to demo dataset" visibly changes only local fixtures; KPIs recalculate.
- [ ] Distinguish `missing`, `incomplete`, `stale`, `unpublished`, `approved`, `resolved` states accurately.
- [ ] A visible DEMO badge and "No CMS write" language appears when appropriate.
- [ ] Search, filters, keyboard nav, responsive layout, error/empty states work.
- [ ] Tests cover scoring, locale fallback semantics, non-localizable fields, proposal state transitions.
- [ ] README includes exact start commands and a 3-minute demonstration script.

## 12. Acceptance criteria (P0 live integration; credentials are available)

- [ ] Read-only CMA integration with region, branch and locale support.
- [ ] Real entries/content types/locales paginated and schema-normalized.
- [ ] Sync status/partial failures visibly disclosed, never silently completed.
- [ ] No credentials in browser JS, network logs, error messages, screenshots, exports.
- [ ] Approvals stored durably with source fingerprint and selected actor.
- [ ] Rate-limiting, retry/backoff, sync cancellation and timeouts.
- [ ] No CMS publishing or writing in default build.
- [ ] Verified live OpenAI proposal route with explicit consent to send selected content, validated output, and truthful usage record.
- [ ] Verified live CMS read result, or a specific transparent permission/network blocker; no fabricated success.

## 13. Acceptance criteria (P2 / authorized write-back)

- [ ] Distinct read vs write privilege and explicit `ENABLE_CMS_WRITES=false` default.
- [ ] Current entry read-back + source fingerprint check before every write.
- [ ] Conflict detection and no silent overwrite.
- [ ] Writes only approved fields in the selected locale; preserves non-localizable nested metadata.
- [ ] Audited and idempotent, read-back verifies actual content update.
- [ ] Separate consent and controls for any publishing (not included by default).

---

## 14. Test plan

**Unit:**
- Matrix numerator/denominator; `eligible=0` returns N/A.
- Schema marks field as non-localizable ⇒ excluded.
- Fallback-only text never counted as explicitly localized.
- Empty whitespace ⇒ missing or incomplete by type/rule.
- `sourceHash` different + approved source baseline ⇒ stale; baseline absent ⇒ unknown.
- Approved proposal cannot silently become "written"; read-back needed.
- Reject returns to issue queue without modifying entry.
- Score monotonic when issue is resolved and other input unchanged.
- Model output containing altered placeholders is rejected/flagged.

**Integration tests:** mocked CMA pagination, rate limit, locale existence, version conflict, partial failure, and read-back.

**E2E Playwright:** open overview, filter `it-it` issues, open one, edit, approve, apply to demo, assert issue status and derived KPI, reset demo; keyboard-only test. Mobile screenshot. No network requirement for demo.

**Security:** route rejects missing auth, live write disabled by default, cannot target arbitrary URL from browser, no sensitive environment variables serialized.

---

## 15. Implementation milestones and interview priority (LIVE FIRST)

**P0 / connected interview proof (highest priority; credentials are available)**
1. Scaffold Next.js + Tailwind + shadcn and move reference HTML into accessible components.
2. Add server-side Contentstack CMA client, `.env.local` config, region/branch/locale handling and safe connection diagnostics.
3. Fetch real locales, content types and a bounded, paginated sample of entries. Scan explicit locale-presence endpoint and applicable schema fields.
4. Display **actual, provenance-labeled** coverage data and actionable field issues. Show sync completion/partial errors; never show demo values as live.
5. Build server-side OpenAI translation proposals with policy gate for external AI, model compatibility check, schema validation and usage telemetry.
6. Implement editable proposal review with separate `approve`, `reject`, and optional `write draft` states; save local/persistent review log as appropriate.
7. Keep fixture-powered offline DEMO switch with equivalent UX so a network or permission failure cannot ruin the presentation.
8. Test integration mocks plus at least one read-only live call, TypeScript checks and build.

**P1 / write safely (only if a test target is available)**
1. Separate write-scope token / app-level permission and explicit `ENABLE_CMS_WRITES=false` default.
2. Re-read source and localized entry and check reviewed fingerprints, then merge a single allowed localized field without disturbing non-localizable metadata.
3. Write a **draft only** to sandbox branch/test entry after explicit confirmation, verify read-back, audit outcome. Recognize that pre-read is not an atomic server-side CAS guarantee.
4. Add durable Postgres review persistence and scan checkpoints where time permits.

**P2 / future**
1. Business-impact joining with real BigCommerce + GA4 data.
2. Release Guardian, reference graph, schema governance, scheduled scans and AI ROI.

**Stop rule:** Preserve the complete offline demo and truthful integration diagnostics even if real tenant permissions are insufficient. A polished *partially live* demo is better than a fake live demo.

---

## 16. Claude workflow prompt (paste into Claude Code)

```text
You are the principal engineer and product designer implementing Contentstack Intelligence Hub for a job interview on 21 October 2026.

Read README.md, CLAUDE_HANDOFF.md, LIVE_INTEGRATION.md, .env.example, and demo/index.html. The user has working Contentstack and OpenAI credentials, which they will insert locally into .env.local. NEVER ask to paste secrets into chat or commit them.

Main mission: produce a polished LIVE-first Next.js App Router + TypeScript strict + Tailwind + shadcn/ui dashboard. Real Contentstack CMA scan and real OpenAI-generated translation proposals are part of P0, not optional future work. Keep a deterministic offline DEMO mode for fallback; never mix fixture counts with live counts or mislabel their origin. The static HTML is a visual and interaction reference; rebuild with clean, accessible React components (no iframe).

Prioritize:
1) secure env validation, CMA region/branch/headers, Connect & Diagnose, read-only content type/locale scan;
2) bounded, paginated entries scan and explicit /locales presence detection, schema-aware field eligibility;
3) real coverage and content-health KPIs, localization matrix and issue queue;
4) a real OpenAI server-side proposal workflow, after clear opt-in to send selected content to an external AI provider, with model compatibility validation and placeholder preservation;
5) editable human review and audit, with approval clearly distinct from CMS write;
6) fallback demo workflow visually matching demo/index.html, and truthful error/empty states.

Live CMS write-back is a separate authorized milestone: disabled by default, only sandbox/test branch with explicit confirmation, refreshed version/hash, schema-aware merge, read-back and no auto-publish. Do not turn ENABLE_CMS_WRITES or ENABLE_CMS_PUBLISH on automatically.

Start with PLAN.md; implement in slices, run tests/typecheck/lint/build, and report verified live steps and remaining limitations. Make reasonable decisions autonomously without preventable clarifying questions. Never claim an API connection was tested unless it actually was.
```

---

## 17. Environment configuration

**Use the checked-in `.env.example`** as the full reference, copy it to `.env.local`, and keep `.env.local` out of version control. `DATA_MODE=live` prioritizes the real CMA integration. Secret values belong exclusively in server modules. Do not use `NEXT_PUBLIC_` for credentials. Set `AI_SEND_CONTENT_TO_OPENAI=true` only if the actual CMS content is approved for transfer to the OpenAI API.

The Contentstack API base URL must match your actual stack hosting region, not your own geographic location. For management-token authentication include server-side `api_key` and `authorization` headers. See `LIVE_INTEGRATION.md` and Contentstack's CMA docs for the official regional host list.

```dotenv
DATA_MODE=live
CONTENTSTACK_API_BASE_URL=https://api.contentstack.io
CONTENTSTACK_API_KEY=
CONTENTSTACK_MANAGEMENT_TOKEN=
CONTENTSTACK_BRANCH=main
OPENAI_API_KEY=
OPENAI_MODEL=gpt-6-luna
OPENAI_REASONING_EFFORT=low
AI_SEND_CONTENT_TO_OPENAI=false
ENABLE_CMS_WRITES=false
ENABLE_CMS_PUBLISH=false
```

Verify the configured OpenAI model exists and supports the chosen reasoning parameter on the actual account. Do not silently substitute a model or assume a current price without fetching or configuring it.

---

## 18. Risks, boundary cases, and honest demo claims

| Risk | Defense |
|---|---|
| Contentstack already has similar functionality | Position as operational unification; compare workflows, not feature-name checkboxes |
| Locale fallback inflates coverage | Use explicit localization existence and per-field schema |
| Source updated ≠ translation stale | Use last-approved fingerprint; unknown baseline is unknown |
| Nested Contentstack fields overwritten | Schema-aware merge; immutable nested metadata; read-back |
| Empty translations intentional | Market-policy/field-policy exemptions, explicit overrides |
| A single score hides critical blockers | Surface issue list and hard blockers separately |
| Invalid AI output | Structured validation, glossary/placeholder checks, human review |
| Demo simulates business ROI | Clearly distinguish sample opportunity from real GA4/commerce signals |
| Privileged management credentials | Server-only storage, least privilege, rotate and never expose |
| Time pressure | Ship polished P0; no partially functional fake live toggles |

---

## 19. Primary docs and verification sources

All links below are vendor documentation or official vendor pages, checked for this handoff on **20 October 2026**.

**Contentstack**
- Agent OS (Polaris, Agents, Automations): https://www.contentstack.com/docs/agent-os/what-is-contentstack-agent-os
- CMS analytics and content lifecycle metrics: https://www.contentstack.com/docs/analytics/analytics-for-cms
- Management API entries and localization: https://www.contentstack.com/docs/developers/apis/content-management-api/entries
- Management API content type schema and pagination: https://www.contentstack.com/docs/developers/apis/content-management-api/content-types
- Delivery API published-only/fallback behavior: https://www.contentstack.com/docs/developers/apis/content-delivery-api/entries
- App SDK full-page/dashboard locations: https://www.contentstack.com/docs/developers/sdks/contentstack-app-sdk/typescript/about-contentstack-app-sdk
- Organization-level Global Full Page app: https://www.contentstack.com/docs/developer-hub/global-full-page

**Competitors**
- Contentful AI Actions: https://www.contentful.com/help/ai-automations/ai-actions/
- Contentful AI Actions translation templates: https://www.contentful.com/help/ai-automations/ai-actions/ai-actions-templates/
- Storyblok localization / AI Translations: https://www.storyblok.com/docs/manuals/translations
- Amplience Workforce Flows: https://amplience.com/platform/workforce/flows/
- Amplience CMS localization flow: https://amplience.com/platform/workforce/flows/cms-content-localization/

**Model note:** Do not claim a fixed API model ID or token price without confirming the current account and official model catalog before going live. The app can accept a configurable model string and display mock cost estimates as illustrations only.

---

## 20. Delivery checklist

- [ ] Working `npm run dev` with attractive desktop and mobile layout.
- [ ] At least two hero journeys: localization approval and content health issue investigation.
- [ ] Strong visual signal of demo/live state and what data is sample.
- [ ] Screenshot(s) / screen capture of dashboard for interview backup.
- [ ] `PLAN.md`, `README.md`, `.env.example`, tests and concise architecture map.
- [ ] Speak confidently about functionality that **exists today**, risks not yet solved, and next implementation milestones.

**Success is not the number of flashy AI buttons. Success is a credible engineering/product workflow with auditability, business context, and controlled actions.**
