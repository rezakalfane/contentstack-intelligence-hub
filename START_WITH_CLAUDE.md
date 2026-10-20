# START HERE — paste this into Claude Code

Build **Contentstack Intelligence Hub**, a live-first technical interview application using Next.js, TypeScript, Tailwind and shadcn/ui.

I already have **Contentstack and OpenAI credentials**. I will put them **locally** in `.env.local`, using `.env.example`. Do **not** ask me to paste secrets into chat, commit them or expose them to client-side code.

First inspect these project files in order:

1. `README.md` — contents and run instructions.
2. `CLAUDE_HANDOFF.md` — full product/engineering spec, domain models, design, UX, tests, and 10-feature roadmap.
3. `LIVE_INTEGRATION.md` — explicit revised **live-first** implementation and safety plan.
4. `demo/index.html` — self-contained interactive approved **visual reference**. Reimplement as proper React components, not an iframe.
5. `.env.example` — required server-side integration settings.

**Build priorities:**

- A polished dashboard that closely follows the HTML design; route navigation, KPIs, localization matrix, searchable issue queue, review panel.
- A real read-only Contentstack CMA adapter: region, API key/management token, branch, content types, locales and bounded paginated entries scan, visible sync status, partial failures and credential diagnostics. Distinguish explicit localized versions using the CMA `.../locales` endpoint and exclude non-localizable fields. Never use delivery fallback to claim translation is complete.
- Actual CMS-derived locale and content-health metrics, each showing source provenance and scan timestamp. Do not mix with or mislabel mock metrics.
- Real server-side OpenAI proposal generation for user-selected text, gated on approval to transfer selected CMS content to an external provider. Validate model compatibility and output; use glossary, correct locale and placeholders; show usage and any estimated cost.
- Human-in-the-loop editor: original/current/proposed fields, inline edits, approve/reject and audit history. **Approving does not write to Contentstack.**
- A robust `DEMO DATA` fallback from fixtures so the interview works even if live access fails; an obvious `LIVE` vs `DEMO` badge.
- Optional explicit write-to-**draft** workflow only with a safe test branch/entry, a separately authorized write permission and re-read/version/fingerprint checks. Disabled by default; never auto-publish. Don't claim atomic conflict protection without API support.

Create `PLAN.md`, implement the minimum end-to-end path and run checks (`lint`, `typecheck`, unit tests, build). At completion, tell me which calls **actually** worked against Contentstack/OpenAI and what remains simulated, plus exact run commands.

**Interview story:** Connect → scan real Contentstack entries → find Italian or another actually present locale gap → generate live AI proposal → review/edit/approve → demonstrate audit and safe write architecture. If necessary switch to offline demo and show recalculated metrics. Focus on credibility and polished execution, not quantity of superficial features.

Start now and make reasonable choices autonomously.
