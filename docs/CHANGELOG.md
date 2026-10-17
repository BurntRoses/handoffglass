# Changelog

## 0.3.0 — 2026-10-17

- Split MCP stdio adapters from one lazy-started local Broker; state and Electron are no longer duplicated across hosts.
- Owner isolation: one host cannot supersede, inspect or cancel a session owned by another; busy conflicts are explicit.
- Atomic single-instance startup coordination, private runtime manifest, credential separation and stale-broker recovery.
- Broker status/stop commands, cross-host protocol regression testing, runtime crash/restart coverage.
- Desktop reconnect now requires a fresh renderer heartbeat, and display layout refreshes are debounced.
- Desktop acceptance checklist and rewritten trust/architecture documents.
- Safe zero-write config generator for MCP JSON and Codex TOML, with Windows path quoting tests.
- npm dependency lockfile generated in GitHub Actions and committed; CI now uses `npm ci` on all three operating systems.

## 0.2.0 — 2026-10-17

- Coordinate-free human handoff and up to eight confirmed target annotations.
- Explicit immutable session state, bounded history and truthful user-reported completion semantics.
- Versioned snapshot bridge with reconnect consistency; stronger input validation and loopback hardening.
- Multi-display coordinate utilities and safer Electron IPC decisions.
- 16 unit tests, SDK smoke script, optional manual desktop smoke and CI workflow.
- Expanded README, security document, product and engineering roadmap.
- Post-import fix: treat MCP SDK v2 `serveStdio` as a synchronous handle; GitHub Actions subsequently passed on Linux/macOS/Windows.

## 0.1.0 — 2026-10-16

- Initial MCP tool definitions, one-target desktop overlay, local bridge and prototype UI.

## Unreleased — independent Agent readiness

- Enforce HTTP route methods and bound concurrent long-poll listeners in the local bridge.
- Add regression tests for method confusion and polling resource exhaustion.
- Add autonomous developer instructions (`AGENTS.md`) and independent development handoff (`docs/AGENT_HANDOFF.md`).
