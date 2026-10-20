# Maintenance scripts (live stack)

These talk to the real stack with the management token and are separate from the app's safety model. All write drafts only and never publish. Backups are written to `backups/` (gitignored, contains real content).

```bash
npm run live:scan                                        # read-only smoke test, prints counts only
npm run live:seo                                         # read-only: SEO / AI-discoverability audit of the live stack (counts + one example per rule)
npm run cs:backup                                        # read-only: every en-us + fr-fr entry and the schemas
npm run cs:degrade  -- backups/<ts>                      # PREVIEW: blank ~10% of fr-fr text fields
npm run cs:degrade  -- backups/<ts> --apply              # write drafts + degrade-manifest.json
npm run cs:restore  -- backups/<ts>                      # PREVIEW restore from the manifest
npm run cs:restore  -- backups/<ts> --apply              # put the original values back (only if still blank; --force to override)
npx tsx scripts/diff-fr.mts backups/<ts>                 # read-only: what differs from the backup
```

`cs:degrade` exists to make gaps visible for demos. The manifest is written incrementally so a crash can still be restored, and `--apply` resumes safely.

---
[← Back to README](../README.md) · [All documentation](README.md)
