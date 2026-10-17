# Changelog

## 0.3.0 — 2026-10-17

- Split MCP stdio adapters from one lazy-started local Broker; state and Electron are no longer duplicated across hosts.
- Owner isolation: one host cannot supersede, inspect or cancel a session owned by another; busy conflicts are explicit.
- Atomic single-instance startup coordination, private runtime manifest, credential separation and stale-broker recovery.
- Broker status/stop commands, cross-host protocol regression testing, runtime crash/restart coverage.
- Desktop reconnect now requires a fresh renderer heartbeat, and display layout refreshes are debounced.
- Desktop acceptance checklist and rewritten trust/architecture documents.

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
