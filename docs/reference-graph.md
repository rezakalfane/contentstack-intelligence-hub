# Reference Impact Graph

Entries, the entries they reference and the assets they use, from reference fields, JSON RTE embeds and file fields, including inside groups, blocks and global fields. Pan/zoom, draggable nodes, search, content-type filters, and two highlight modes: **Blast radius** (everything that transitively references the selected entry, coloured by hop distance, cycle-safe) and **Dependencies**. The side panel gives counts, ranked dependents, the entry's open localization issues and a Contentstack deep link, and lists **hubs**, **broken references** (only for fully scanned content types) and **entries nothing references**.

Limits: references are read from master-locale entries; "not referenced" does not mean unused (pages are reached by URL); capped or failed content types show targets as *unverified*, never broken; the layout runs in the browser, so very large stacks would need server-side graph pagination.

---
[← Back to README](../README.md) · [All documentation](README.md)
