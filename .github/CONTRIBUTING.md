# Contributing

Use Node.js 22+ and the committed npm lockfile. Start with [the code map](../AGENTS.md) and [architecture](../docs/ARCHITECTURE.md).

```sh
npm ci --omit=optional --no-audit --no-fund
npm run handoff:check
npm run test:integration
npm run test:extras
npm run test:legacy
npm run connection:check
npm run release:check -- --preview
```

These checks use isolated headless runtimes. Do not point a test at a contributor's real host configuration, home directory or normal Broker. Use temporary fixtures for installation, rollback and cleanup. Preserve modified and unrecorded files. Never commit credentials, local connector bundles, personal paths or generated packages.

For desktop changes, install optional dependencies, run the [desktop QA](../docs/DESKTOP_QA.md) and record which platform/scenario actually ran. Mocked display layouts are not physical multi-display acceptance. Run [the packaging checks](../docs/COMMUNITY_RELEASE.md) when changing shipped resources or installers.

A pull request should explain the user-visible problem, resulting behavior, validation and remaining limitations. Include a focused reproduction for bug fixes. Keep host support claims tied to actual evidence. Report security issues through [the private reporting process](../docs/SECURITY.md), not a public bug report.

Contributions are accepted under the existing [PolyForm Noncommercial License](../LICENSE). Preserve the project notice and all third-party license notices.
