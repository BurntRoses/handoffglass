# HandoffGlass — instructions for coding agents

Start with [the Codex handoff](docs/CODEX_HANDOFF.md), then [the architecture map](docs/ARCHITECTURE.md). `docs/INDEX.md` links the rest. Treat the current code, tests and actual desktop observations as authoritative over old prose.

## Goal

Make the existing **local** human↔agent visual handoff reliable on real macOS and Windows desktops. Fix failures, run acceptance scenarios, improve the UX, and document evidence. Do not build a new assistant, browser automation bot, parallel broker, or platform-specific copy of the core.

## Invariants

1. Humans make sensitive decisions. Never auto-approve permissions, bypass MFA, click a payment/consent control or invent a target location.
2. `completed` is a **user report** (`verified: false`); independently verify the downstream result. Refusals, cancellations and timeouts are final.
3. Keep the per-user Broker loopback-only with separate agent/desktop bearer credentials, bounded requests, owner isolation and a single active session. Never recover an old session just from a public ID.
4. Accessibility inspection requires explicit opt-in and exact foreground evidence. On ambiguous, stale, unavailable or cross-display targets: **remove guidance rather than guess**.
5. No hidden screenshots, recording, OCR, telemetry, external calls, long-term task history or Agent writes to user preferences. Follow OS reduced-motion settings.
6. A GUI crash or missing desktop must not be reported as a displayed overlay. Do not conflate headless CI, packaged MCP handshake and native desktop acceptance.
7. Preserve public MCP tool names and response contracts. Keep optional schema-heavy tools behind `HANDOFFGLASS_EXTRAS=1`.
8. Keep Electron optional for headless MCP. Native or renderer edits require macOS/Windows regression scenarios, not just Node tests.

## Change workflow

- Work from a fresh branch, inspect the affected module and its adjacent tests first; keep changes scoped. Do not change unrelated user settings or rewrite history.
- Baseline: `npm ci`, `npm run verify`, `npm run test:integration`, `npm run connection:check`, `npm run test:extras` (Node 22+). If installation is unavailable, run dependency-free checks and state the missing verification.
- For GUI work: `npm run desktop:demo` and `docs/DESKTOP_QA.md` on an **actual** interactive desktop. Record OS version, display layout/scaling, permissions, reproduction steps, expected/actual result and redacted evidence.
- For packaging: `npm run build:icons`, `npm run native:macos` on macOS, then `npm run dist:desktop`. Inspect `electron-builder.config.cjs`; CI creates **unsigned engineering previews**, not a signed release.
- For scene/visual changes: run `npm run gallery`, `npm run scene:lint` and update the *production* renderer, schema, preview and tests together.
- Every PR: explain behavior, commands/results, evidence, remaining risk and any new permissions. Do not mark GitHub Issues #1, #3, #4, #9 or #10 complete without their stated real-world evidence.

## Code ownership map

| Change | Files to read first |
|---|---|
| Session/state/ownership | `src/core.mjs`, `src/local/interaction-journal.mjs`, `test/core.test.mjs` |
| MCP/host registration | `src/mcp.mjs`, `src/config.mjs`, `src/host-install.mjs` |
| Broker, launch, security | `src/runtime.mjs`, `src/broker.mjs`, `src/bridge.mjs` |
| Native AX/UIA and tracking | `src/native/`, `native/`, `test/native-locator.test.mjs`, `test/anchor-tracker.test.mjs` |
| On-screen presentation | `src/desktop/`, `src/visual/`, `docs/SCENE_PROTOCOL.md` |
| Packaging/installation | `electron-builder.config.cjs`, `.github/workflows/desktop-packages.yml`, `scripts/verify-package.mjs` |

If you encounter a mismatch between documentation and code, validate the code path, fix the description, and add a regression test where appropriate. Avoid expanding the default tool schema or runtime dependencies without a measured benefit.
