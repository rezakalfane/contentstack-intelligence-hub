# Configuration

Set these in `.env.local` (copy from `.env.example`). Secrets are read only in server modules; never use `NEXT_PUBLIC_` for them.

| Variable | Purpose |
|---|---|
| `DATA_MODE` | `live` (default when configured) or `demo` |
| `CONTENTSTACK_API_BASE_URL` / `CONTENTSTACK_REGION` | Allowlisted CMA host (na, eu, au, azure-na, azure-eu, gcp-na, gcp-eu). Arbitrary URLs are rejected |
| `CONTENTSTACK_API_KEY`, `CONTENTSTACK_MANAGEMENT_TOKEN`, `CONTENTSTACK_BRANCH`, `CONTENTSTACK_ENVIRONMENT` | Read access, branch, and environment for publication checks |
| `OPENAI_MODEL`, `OPENAI_REASONING_EFFORT` | Model and effort. **Effort is read from env only** and recorded on every proposal with reasoning tokens |
| `OPENAI_PRICE_INPUT_PER_MTOK`, `OPENAI_PRICE_OUTPUT_PER_MTOK` | USD per 1M tokens, taken from OpenAI's pricing page for your model. Unset ⇒ cost shows `—`, never `$0`. Cached-input discounts are not modelled |
| `AI_SEND_CONTENT_TO_OPENAI` | Must be `true`, plus per-field consent in the UI, before any CMS text is sent |
| `ENABLE_CMS_WRITES`, `CONTENTSTACK_WRITE_TOKEN`, `CMS_WRITE_ALLOWED_ENTRY_UIDS` | All three are required for the guarded draft write. Default: off |
| `ENABLE_CMS_PUBLISH` | Ignored. Publishing does not exist in this build |
| `SCAN_MAX_ENTRIES_PER_TYPE`, `CRITICAL_LOCALES`, `HUB_ACTOR_ID` | Scan bound (disclosed in the UI), priority markets, reviewer identity for the audit trail |

---
[← Back to README](../README.md) · [All documentation](README.md)
