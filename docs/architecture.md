# Architecture and code layout

**Stack:** Next.js 16 (App Router) · TypeScript (strict) · Tailwind 4 · shadcn-style UI (Radix) · Recharts · d3-force/zoom · TanStack Table · Zod · Vitest · Playwright.

`lib/domain` pure logic (rules, scoring, graph, review state machine, paths, deep links) · `lib/adapters` demo/live adapters, CMA client, guarded writer · `lib/scan` pipeline and view · `lib/ai` prompt, provider, validation, pricing · `lib/security` env, request guard, write policy · `lib/store` JSON store · `app/api` routes · `components/*` UI · `scripts/` live smoke test and maintenance scripts · `tests/` unit + integration · `e2e/` Playwright. See [PLAN.md](PLAN.md), [CLAUDE_HANDOFF.md](CLAUDE_HANDOFF.md) and [LIVE_INTEGRATION.md](LIVE_INTEGRATION.md).

---
[← Back to README](../README.md) · [All documentation](README.md)
