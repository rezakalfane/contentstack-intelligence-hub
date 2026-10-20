# PLAN — Contentstack Intelligence Hub

> **Status (20 Oct 2026):** P0 live read-only scan, OpenAI proposals, review/audit and offline demo are built and verified (see README). Also built: Reference Impact Graph, Contentstack deep links, guarded draft writer (off by default), scan progress/cancel, maintenance scripts. Not built: auth, database, scheduled scans, GA4/BigCommerce.

Live-first, read-only Contentstack scan + real OpenAI proposals, with a deterministic offline DEMO mode.
What is real vs simulated, and what has been verified against the actual stack, is tracked in the README ("What is real, what is simulated").

## Architecture

```
lib/domain      pure logic (no I/O): types, fingerprint, schema flattening, rules, scoring, review state machine
lib/adapters    ContentstackAdapter interface · demo-adapter (fixtures) · live-adapter (CMA, read-only)
lib/scan        analyze(): adapter output -> FieldUnits -> diagnostics -> Snapshot (same code for live and demo)
lib/ai          prompt, Zod validation, placeholder/glossary checks, pricing, OpenAI Responses client (server only)
lib/security    env (Zod), request guard (same-origin + header), write policy
lib/store       file-backed JSON store (.data/, gitignored): snapshots, proposals, audit events
app/api         sync (start/status/cancel) · translation/{propose,review,apply} · mode · status
app/(product)   overview · localization · health · graph · insights · roadmap · settings
```

Key decisions
- **CMA via thin typed fetch adapter** (no SDK): 2 hosts allowlisted by region, retry/backoff+jitter on 429/5xx, bounded concurrency, timeouts, cancellation. Credentials never leave `lib/adapters/live-adapter.ts` / `lib/security/env.ts`.
- **One analysis pipeline.** The demo adapter emits the same normalized shapes as the live adapter, so KPIs are always *computed*, never hardcoded.
- **Orthogonal statuses**: existence / completeness / freshness / publication / proposal state are separate fields.
- **Freshness** is `unknown` unless an approved-source fingerprint baseline exists (created when a reviewer approves a proposal).
- **Approve ≠ write.** Approve stores the decision. "Apply to demo" mutates only the demo overlay. Live write is disabled (`ENABLE_CMS_WRITES=false`) and guarded.
- **Mode switch** is a cookie (`hub_mode`) and every page shows `LIVE · Contentstack` vs `DEMO · Sample fixtures` + scan time.

## Routes
`/overview` `/localization` (matrix, filters, table, CSV, review drawer via `?issue=`) `/health` `/graph` `/insights` `/roadmap` `/settings`

## Acceptance (P0)
1. `npm run dev` → all routes render in DEMO with ≥5 locales, 4 types, ≥50 entries.
2. Demo flow: Italy gap → review → edit → approve → apply to demo → KPIs recalc → reset.
3. Live: Connect & Diagnose, paginated scan (progress, partial failure disclosure, cancel), live matrix/issues.
4. Live AI: opt-in gate, model probe, structured output, validation, usage record. (needs `OPENAI_API_KEY` in `.env.local`)
5. Tests: scoring, fallback semantics, non-localizable, freshness, state machine, validation, CMA pagination/retry/partial failure, write guard, request guard.
6. `lint`, `typecheck`, `test`, `build` green.

## First tasks
scaffold → domain+tests → demo adapter+fixtures → UI shell + overview → localization+review → live adapter+sync → AI → health/insights/roadmap/settings → README/verification.

## Delivered beyond the original P0
- Reference Impact Graph: reference/RTE/file extraction, cycle-safe blast radius, broken-reference and orphan detection, d3-force explorer.
- Deep links into the Contentstack web app (live mode only).
- Per-proposal audit of model, env-configured reasoning effort, tokens, reasoning tokens and computed cost.
- Guarded draft write with modal confirmation, conflict handling and "re-review against current CMS state".
- Scan progress bar, cancellation, retry/backoff with `Retry-After`, partial-failure disclosure.
- Backup / degrade / restore scripts for staging demo data on the live stack.

## Next
Postgres + Drizzle for review/audit, real auth and per-actor permissions, scheduled scans with checkpoints, Release Guardian, GA4/BigCommerce impact, App SDK embedding.
