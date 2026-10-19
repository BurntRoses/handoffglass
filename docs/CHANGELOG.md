## v0.12.0 — local MCP connection check and display layout

- Add an isolated real stdio-MCP preflight: initialize, tool discovery, and read-only headless screen geometry. No host registration is assumed.
- Surface manual diagnostics and code-specific recovery in Control Center without collecting task data.
- Visualize global DIP display bounds and scaling (including negative monitor origins).
- Copy an allowlisted support report free of paths, tokens and task content.
- Add subprocess timeout, ownership and bounds tests and a three-platform CI connection check.

## Unreleased — desktop Control Center

- Dedicated four-page native desktop management window (overview, Agent connections, appearance, diagnostics).
- Read-only, desktop-authenticated, owner-redacted diagnostics with honest Agent activity semantics.
- Reusable host config generator, user preference persistence, read-only UI lookup consent; tray shortcut.
- Sandboxed renderer, no new framework or model dependency; regression and privacy tests.

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

## v0.7.0 — local-first harness integration and refined motion

- User-controlled, on-disk visual preferences (no approval/screen history), selectable from desktop tray.
- Deterministic localized handoff blueprints; optional compact MCP context and blueprint tools.
- Native DeepSeek Harness Cordis plugin source and local-checkout patch generator.
- Tencent WorkBuddy MCP+Skill connector generator and TRAE/DeepSeek/WorkBuddy MCP config entries.
- Declarative integration support matrix, strict unsupported flags for unverified desktop apps.
- Production SVG hand-drawn stroke, refined glass/aura animation, progressive readable panel, reduced-motion support.
- New tests for preferences, connectors, host strategies, local decision plans and CSS contracts.

- Desktop decision panel is bilingual (zh-CN/en-US) and density-aware; preferences appear in the tray and are applied by the broker without a model call.

## Next — autonomous Agent preflight and release reliability

- Add deterministic local-first `handoff_assess` optional tool and policy matrix for all six high-frequency scenarios, including ambiguous/stale/offscreen evidence and sensitive human decisions.
- Add environment readiness CLI with machine-readable JSON and explicit desktop QA boundaries.
- Harden packaged Windows Electron MCP smoke cleanup against short-lived file locks using bounded filesystem retries.
- Extend MCP extras handshake smoke, local policy and readiness regression suites. Keep default eight model-facing tools unchanged.
- Add `docs/AGENT_AUTONOMY.md`, an actionable Agent/Harness selection and verification contract without unrestricted memory access.

- Add offline compact MCP response byte benchmark (avoids unsupported token-saving claims).

- Packaging regression follow-up: explicitly terminate the isolated headless Broker spawned by the packaged MCP test before removing its runtime directory. Merely retrying EBUSY was insufficient (see Actions run 39146346211).

## Unreleased — visual cohesion and first-run usability

- Rebuilt the local setup window with a calm dual-surface layout and responsive vector illustration.
- Added a read-only, host-specific MCP configuration preview with safe concurrent selection handling.
- Fixed source-mode Electron's stdio MCP launch config by explicitly setting `ELECTRON_RUN_AS_NODE=1`.
- Unified first-run and handoff panel color/typography tokens, with system/dark/light appearance preferences.
- Refined decision layout, keyboard focus, high-contrast and reduced-motion behavior.
- Added a scalable, reusable Agent → Human → Agent infographic to all three README languages.
- Added UI contract tests and `docs/INTERFACE_SYSTEM.md`.
