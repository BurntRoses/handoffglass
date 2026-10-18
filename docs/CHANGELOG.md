## 0.4.0 — lightweight multi-harness integration (2026-10-18)

- Add stable `requestId` for idempotent human handoff retries (without resetting user timer).
- Add a bounded async wait pool and explicit overload response.
- Add compact model tool results opt-in (`HANDOFFGLASS_OUTPUT=compact`), preserving the default JSON contract.
- Generate compatible MCP stanzas for Claude, Codex, Cursor, VS Code, Copilot, Gemini and Zed using one shared host adapter.
- Move Electron to optional dependency; CI runs MCP-only to avoid downloading the desktop binary.
- Add asynchronous panel decision acknowledgement with retryable failure state, nonblocking visual guide mode, multi-spotlight compositing and boundary-spanning screen annotations.
- Add host, compact-output and retry regression tests, benchmark harness and Code Agent handoff instructions.
- Expose an optional MCP `assist-with-ui-step` prompt for hosts that support prompts, with full tool compatibility preserved.
- Add opt-in, dry-run-first JSON host config installer with collision rejection, backup and atomic write.
- MCP/broker tests are not a substitute for GUI acceptance on a physical Windows/macOS machine.

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

- Harden loopback routing with explicit HTTP method enforcement and cap simultaneous long-poll responders.
- Add regression tests for method confusion and resource exhaustion.
- Add `AGENTS.md` and `docs/AGENT_HANDOFF.md` with operational boundaries, priorities, commands and per-platform acceptance criteria.

## v0.5.0 — reusable layered visual scenes

- New dependency-free Scene v1 protocol with six composition templates, seven annotation shapes, shared semantic palette and atomic scene edits.
- New MCP `visual_scene_update` (owner scope, expected revision, no renewed TTL) and `template` / `scene` options in existing tools.
- Single production SVG renderer also used by the local gallery; no second renderer or preview-only SVG approximations.
- Portable JSON Schema, three realistic synthetic scene fixtures, product interaction and visual design handbooks.
- Additional unit, bridge, renderer and live MCP integration regression tests. Physical desktop acceptance still outstanding.

- Added fail-closed UI grounding candidate contract and tests (pure library, no active AX/UIA enumeration), and minimal scene template/validation CLI for future adapters.

- Fix stale-manifest broker restart on Windows by clearing the failed manifest under the startup lock before spawning, and surface asynchronous process-launch errors.

- Electron overlay now loads a deterministic classic-script bundle of the same canonical SVG renderer used in gallery; avoids file-URL ESM issues without adding a bundler dependency.

- Normalize renderer source and generated bundle line endings; `.gitattributes` enforces LF across hosts so Windows CI performs the same deterministic integrity check.

## 0.6.0 — Native integration engineering preview

- Add explicitly opt-in, read-only macOS Accessibility and Windows UI Automation foreground-control adapters with fail-closed matching and Electron DPI evidence.
- Add `ui_locate` MCP tool and `target:{app,role,name}` on guide/handoff requests.
- Add standalone packaged Electron GUI bootstrapping its own shared loopback broker, per-user accessibility toggle and lightweight tray interface.
- Add source/desktop dual-runtime documentation and unsigned Windows/macOS packaging workflow.
- Add Cline, Windsurf and OpenCode MCP configuration generation.
- Preserve no-click/no-credential/no-telemetry constraints. Real OS app startup, permissions and GUI tests are still mandatory.
