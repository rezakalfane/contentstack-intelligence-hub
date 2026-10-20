# Getting started

```bash
npm install
cp .env.example .env.local        # fill secrets locally; never commit, never paste into chat
npm run dev                        # http://localhost:3000  → /overview
```

- **Demo (offline, no credentials):** choose *DEMO · Sample fixtures* in the stack menu (top right). 5 locales, 4 content types, 56 entries.
- **Live:** set `CONTENTSTACK_API_KEY`, `CONTENTSTACK_MANAGEMENT_TOKEN`, and `CONTENTSTACK_API_BASE_URL` (must match the stack's **hosting region**), then *Integration → Connect & diagnose* and *Scan Contentstack*.
- **Live AI:** set `OPENAI_API_KEY`, `OPENAI_MODEL`, optionally `OPENAI_REASONING_EFFORT`, and `AI_SEND_CONTENT_TO_OPENAI=true` only if the content may go to OpenAI. Then *Integration → Check OpenAI model access*.

---
[← Back to README](../README.md) · [All documentation](README.md)
