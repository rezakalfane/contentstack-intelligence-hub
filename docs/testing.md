# Quality and testing

```bash
npm run verify      # lint → typecheck → unit/integration tests → build
npm run test        # Vitest: scoring, fallback semantics, freshness, state machine, validation,
                    #         CMA pagination/retry/partial failure, write guards, OpenAI provider (mocked),
                    #         reference graph, SEO rules/scoring/suggestions, schema governance, deep links, restore helpers
npm run e2e         # Playwright (demo mode): journey, reject, placeholder block, keyboard, filters/CSV, graph, SEO audit, schema governance
                    #   E2E_PORT=3000 reuses a running dev server; PW_CHROMIUM_PATH reuses an installed Chromium
```

---
[← Back to README](../README.md) · [All documentation](README.md)
