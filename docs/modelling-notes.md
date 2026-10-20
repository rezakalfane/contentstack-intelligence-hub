# Modelling notes

Domain decisions and findings from running against a real Contentstack stack.

- Existence, completeness, freshness, publication and proposal state are separate fields.
- Delivery fallback is never counted as localized; `/locales` `localized: true` is the source of truth.
- **Instance IDs can differ between locales** (fr-fr blocks/groups had different `_metadata.uid`s). Fields match by UID first, then by position, and the evidence says so.
- **Contentstack drops blank items from multi-value text fields**, so those arrays compact. The restore script re-inserts them by index.
- Freshness is `unknown` unless an approval baseline exists (created when you approve a proposal). Never guessed.
- "Identical to source" is flagged as *possibly untranslated*; product names may legitimately be unchanged, so a reviewer decides.
- Policy exclusions (identifier-like fields, enums, non-localizable fields) are disclosed in the UI.
- Updates to the CMA must send assets as UIDs, not full asset objects (`"is not a valid upload"`).

---
[← Back to README](../README.md) · [All documentation](README.md)
