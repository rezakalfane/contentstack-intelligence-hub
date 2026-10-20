# What is real, what is simulated

Honest boundaries of this prototype.

| Piece | Status |
|---|---|
| Contentstack CMA reads (locales, content types, entries, explicit `/locales` presence, publish details, references) | **Real**, read-only, server-side, verified against a live EU stack |
| Coverage / health / issue rules / graph | Real computation over whichever dataset is loaded |
| SEO & AI audit | **Real** rules over real master-locale entries (verified on the live stack). Suggestions are **simulated** in demo and OpenAI in live (verified against a mocked API only). No live write-back for SEO text; copy the approved text |
| OpenAI proposals | **Real** when configured and consented. Code is verified against a mocked Responses API; run it with your own key to verify live |
| DEMO data and DEMO proposals | **Simulated** (sample phrase bank), always labelled |
| "Apply to demo" | Changes only the local demo overlay (`.data/demo.json`) |
| Live CMS draft write | Implemented as a guarded, single-field, draft-only writer; **disabled by default**; unit-tested with mocks; see [Safety model](safety.md) |
| Publishing | **Does not exist** |
| Trend chart | Live: recorded scan history. Demo: labelled *illustrative* |
| GA4 / BigCommerce impact | Not implemented; clearly marked future |

## Known limitations

No authentication or database (local JSON; Postgres + real sessions are the production path) · live write path not exercised end-to-end against a stack · OpenAI path not exercised live unless you add a key · scan is bounded and in-process (no scheduler) · references are master-locale only · deep-link URL shapes follow the app's hash routes and were not click-tested on every plan/region.

---
[← Back to README](../README.md) · [All documentation](README.md)
