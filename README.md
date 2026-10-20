# Contentstack Intelligence Hub

Cross-market content operations intelligence for Contentstack: find localization gaps at field level, see what an edit could break across references, and make AI translation fixes reviewable and auditable.

> Independent prototype, not affiliated with Contentstack. Reads a stack **read-only** by default; approving an AI proposal is never a CMS write, and nothing is ever published.

![Overview](screenshots/demo-overview.png)

## Quick start

```bash
npm install
cp .env.example .env.local   # add your own credentials; never commit this file
npm run dev                   # http://localhost:3000
```

Works offline with no credentials: switch to **DEMO · Sample fixtures** in the stack menu. For a live scan and OpenAI proposals, see [Configuration](docs/configuration.md).

## Documentation

- **[Getting started](docs/getting-started.md)** · **[Configuration](docs/configuration.md)** · **[Features](docs/features.md)**
- **[Reference graph](docs/reference-graph.md)** · **[Safety model](docs/safety.md)** · **[What is real vs simulated](docs/status.md)**
- **[Demo script](docs/demo-script.md)** · **[Testing](docs/testing.md)** · **[Architecture](docs/architecture.md)**
- [Full documentation index](docs/README.md)

Checks: `npm run verify` (lint, typecheck, tests, build).
