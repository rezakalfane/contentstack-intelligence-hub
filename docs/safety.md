# Safety model

- Secrets only in `.env.local`, read in server modules. Nothing uses `NEXT_PUBLIC_`; `/api/status` returns booleans/labels only; errors never include headers.
- CMA hosts are allowlisted by region; the browser cannot supply URLs.
- Mutating routes require same-origin and an `x-hub-request` header. **This is not user authentication**: it is a single-user local prototype. Production needs real sessions, roles and per-actor permissions.
- **Approve ≠ write ≠ publish.** Approval needs non-empty text, no placeholder/markup mismatch, and an unchanged source fingerprint (409 otherwise).
- Guarded writer requirements: `ENABLE_CMS_WRITES=true`, a separate write token, the entry in `CMS_WRITE_ALLOWED_ENTRY_UIDS`, explicit confirmation in a modal, fresh re-read, fingerprint + version check (409 on conflict), single-field merge with assets sent as UIDs, read-back verification before a proposal becomes `written`. A pre-read is **not** an atomic compare-and-swap. After a conflict the reviewer can **re-review against the current CMS state**.
- The review panel lists exactly which write conditions are unmet.
- Review/audit state and the last live snapshot are stored as local JSON in `.data/` (gitignored). The live snapshot contains source/target text; delete `.data/` to purge.

---
[← Back to README](../README.md) · [All documentation](README.md)
