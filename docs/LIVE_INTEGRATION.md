# Live-first integration runbook

**Prepared:** 20 October 2026  
**Use:** Technical handoff for Claude Code. This is a runbook, not a claim that any live connection was tested.

## Decision

The owner **does have Contentstack and OpenAI credentials**. Therefore Claude should implement **real CMS read-only inventory and real OpenAI proposal generation as interview P0**, not as future add-ons. Keep an explicit offline `demo` mode for a reliable fallback, but prioritize an actual connection and actual data when accessible. CMS writes remain a separate, opt-in and guarded milestone; nothing should publish automatically.

## Required inputs (do not send secrets through the assistant chat)

Copy `.env.example` → `.env.local`, then populate privately in the Claude Code workspace:

- `CONTENTSTACK_API_KEY` — stack API key.
- `CONTENTSTACK_MANAGEMENT_TOKEN` — ideally read-only scoped to the target stack, branch and necessary content types.
- `CONTENTSTACK_API_BASE_URL` — **match stack region** (AWS NA `https://api.contentstack.io`, AWS EU `https://eu-api.contentstack.com`, and other official regional hosts).
- `CONTENTSTACK_BRANCH` — if applicable.
- `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_REASONING_EFFORT` — check accessible model/parameter at runtime.
- Optional: master locale, content type allowlist, desired target markets, target environment UID.

**Avoid a delivery token for content-management inventory**: it does not expose unpublished drafts or all management data. CMA uses headers `api_key: <stack-api-key>` and `authorization: <management-token>` for Management Token authentication. All calls occur server-side. Consult official CMA documentation: https://www.contentstack.com/docs/developers/apis/content-management-api

## Stage A — Connection diagnosis (read only)

1. Validate `.env.local` with Zod; redact secrets and never log their values.
2. Build a strict allowlisted CMA base URL using the selected region; reject user-provided arbitrary URLs.
3. Test `GET /v3/content_types` on the server with the region-specific base URL, `api_key`, `authorization`, and optional `branch` headers. Display `Connected`, `Forbidden`, `Wrong region`, `Network error` or `No content types`, preserving sanitised error details.
4. Retrieve locales using the documented language endpoint/SDK, inspect master locale and fallback settings and validate target locale codes. If the chosen token lacks stack-level locale permissions, present an explicit partial-data status rather than inventing markets.
5. Paginate entry inventory by content type and master locale. Use bounded concurrency (e.g. 3–5), 429/5xx retry with backoff+jitter, cancellation, scan progress and partial-failure reporting.
6. For every entry requiring localization, call `GET /v3/content_types/{ct}/entries/{uid}/locales` to distinguish **explicit locale versions** from delivery fallback. Get localized draft/version/publishing metadata separately as needed. Schema recursion excludes `non_localizable` fields.
7. Display actual counts with a `LIVE · Contentstack` badge, stack/region/branch and scan timestamp. If no permission/data, show truthful empty/error state; allow user to switch to `DEMO · Sample fixtures`.
8. Persist only the minimum snapshot or hashes needed for comparison. Don't dump raw private content in logs, mock exports or public demos.

## Stage B — Real OpenAI translation proposals

1. Ask for an explicit user action to translate selected content. Only send CMS content to OpenAI if the user has permission to use it with an external AI provider (`AI_SEND_CONTENT_TO_OPENAI=true` and UI confirmation).
2. Build typed and validated requests to OpenAI **on the server only**. Probe/model-check `OPENAI_MODEL` compatibility with low reasoning effort and structured output; if unavailable, surface the provider error and permit selecting a supported model. Do not silently swap models.
3. Translate selected localizable text leaves, carrying source locale, target locale, content-type field context and glossary. Preserve placeholders and rich-text shape. Do not send entry credentials, customer personal data or full raw CMS object unnecessarily.
4. Record proposal source hash, current CMS version, prompt version, model, API usage and approval state. Cost is actual where usage/pricing is available, otherwise explicitly estimated.
5. Review screen: source / existing target / generated proposal (editable), diagnostics and audit timeline. `Approve` means **approve proposal**, not CMS write.

## Stage C — Explicit draft write-back (only after P0 succeeds)

1. `ENABLE_CMS_WRITES=false` initially. Prefer a separate write-scoped token and a **non-production** Contentstack branch/stack/entry for demonstrations.
2. Require explicit reviewer confirmation, field/locale/entry preview, and a fresh read of current source and localized target before writing. Refuse on mismatch of reviewed source fingerprint or expected target version; require re-review.
3. Use schema-aware merge; preserve nested `_metadata.uid` / `non_localizable_content` requirements for Group, Global Field and Modular Block structures.
4. Call `PUT /v3/content_types/{ct}/entries/{uid}?locale={target}` only after permission checks, then re-read and verify expected fields. Update audit state only after verified success.
5. **No automatic publishing** (`ENABLE_CMS_PUBLISH=false`). Contentstack docs state localize/update calls do not publish; publication requires its own action. Also note a GET/recheck before PUT reduces races but does not by itself guarantee atomic conditional updates. Do not overclaim concurrency protection without a documented server-side version precondition.
6. Display CMS target (stack/branch/locale) and confirmation summary before mutation, plus a copyable sanitized audit entry afterward.

Docs: https://www.contentstack.com/docs/developers/apis/content-management-api/entries

## First 90-minute target sequence for Claude (adaptive, not a time promise)

- Connection status + server-side API client + environment validation.
- Live list of content types / locales / entry counts and scan health status.
- Deterministic issue rules and locale coverage matrix from retrieved content.
- One real AI proposal, editable human review, with *no CMS write*.
- Static HTML visual direction transferred into Next.js; keep the offline demo switch.
- Tests around fallback-localization existence, non-localizable fields and approval/write boundary.

If Contentstack authorization fails, retain the complete fixture-backed demo and show the precise integration blocker rather than pretending to have live data.

## Minimal acceptance demo

1. Click **Connect / Scan Contentstack** → displays true content types, locales and scan timestamp (no hardcoded counts).
2. Filter `it-it` or a locale actually found in stack → show field issues with source evidence and `LIVE` provenance.
3. Click an issue → request real AI proposal → editable review → approve.
4. Show proposal state and audit record; if explicitly enabled and using a safe test entry, write approved text to draft and verify it by fetching it again.
5. Never equate approval with publishing. Never silently turn `ENABLE_CMS_WRITES` or `ENABLE_CMS_PUBLISH` on.

## Official references

- Contentstack CMA base URLs, authentication: https://www.contentstack.com/docs/developers/apis/content-management-api
- Contentstack entries, localization and publishing: https://www.contentstack.com/docs/developers/apis/content-management-api/entries
- Contentstack schema: https://www.contentstack.com/docs/developers/apis/content-management-api/content-types
- OpenAI Responses API: https://platform.openai.com/docs/api-reference/responses
