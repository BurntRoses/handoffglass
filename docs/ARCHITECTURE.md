# Architecture

HandoffGlass is an **on-device interaction runtime**, not an independent task-planning agent. It turns an Agent's grounded instruction into desktop visual guidance or a human decision, then returns a bounded, owner-scoped result.

## Runtime topology

```text
MCP clients (Codex, Claude, Trae, WorkBuddy, …)
  └─ stdio src/mcp.mjs  [one process and ephemeral owner ID per client]
       └─ src/runtime.mjs  [private discovery manifest / single-start lock]
            └─ 127.0.0.1:<random port> + agent bearer
                 └─ src/broker.mjs  [single long-lived Broker]
                      ├─ src/core.mjs  [HandoffManager: one active session]
                      ├─ src/local/interaction-journal.mjs  [bounded ephemeral event cursor]
                      ├─ src/native/anchor-tracker.mjs  [opt-in local target recheck]
                      └─ src/bridge.mjs  [credential- and route-separated IPC]
                           └─ desktop bearer → src/desktop/main.mjs
                                ├─ click-through overlay per display
                                ├─ separate clickable human decision panel
                                ├─ first-run setup / Control Center
                                └─ macOS AX / Windows UIA read-only locator
```

When the installed Electron GUI is the launcher, `src/desktop/app.mjs` hosts the Broker; when MCP clients launch the source project, `src/runtime.mjs` starts one Broker as needed. These paths must converge on one runtime session, never parallel state stores. Desktop windows use isolated renderers, scoped preload APIs and local resources. The preview in `site/` is not a native UI test.

## Ownership and lifecycle

`HandoffManager` is authoritative. Continuous tools keep one session ID and screen owner through:

```text
awaiting_user (waiting_user / presenting)
  → user_action_reported (verifying)
  → observing (next_step)
  → awaiting_user (next step)
  → completed, declined, cancelled, expired or superseded
```

A completion button is a user report. The Agent checks the original app and calls `session_verify`; `verified:true, finish:true` ends a continuous workflow. Otherwise `session_present(sessionId, …)` advances it without renewing its original timeout. A new request by the same owner can supersede; another owner sees `busy`. `requestId` deduplicates retries within an owner and step. A new MCP process has a new owner ID and cannot reclaim an earlier process's session. Legacy `handoff_request` retains the one-step completion contract.

The in-memory journal retains bounded cursor events. `session_wait` immediately returns available meaningful events, otherwise waits for journal changes; it does not wait for a terminal session first. Consecutive target movements are coalesced and do not independently wake an Agent waiter. Timeout/disconnect removes listeners. `truncated:true` reports dropped history. Restarting the Broker discards sessions and events.

The desktop receives authenticated SSE snapshots over `/desktop/stream`, with a bounded connection count, heartbeat and slow-reader limit. Reconnection starts from the current snapshot. The old `/poll` route remains for existing desktop adapters, but the production desktop uses push. Native target following remains local.

User preferences persist locally. `integration_set_enabled` changes only the global switch on a user request; disabling immediately cancels active guidance and clears tracking. Accessibility consent remains an app-only user choice, separate from OS permission. See [lifecycle and cleanup](INTEGRATION_LIFECYCLE.md).

## Interfaces

**Default MCP tools (15):** `screen_displays`, `ui_inspect`, `ui_locate`, `capability_manifest`, `session_start`, `session_present`, `session_wait`, `session_update`, `session_verify`, `session_stop`, `connection_status`, `permission_status`, `integration_status`, `integration_cleanup` and `integration_set_enabled`. Tool results include machine-readable `structuredContent` and a text fallback. Installers enable compact output.

`HANDOFFGLASS_LEGACY_TOOLS=1` adds the seven old one-step/scene aliases for existing clients. They are excluded from the normal tool catalog. `HANDOFFGLASS_EXTRAS=1` adds the three local read-only helpers (`handoff_context`, `handoff_assess`, `handoff_blueprint`). Initialization includes the core workflow in fewer than 512 characters; `capability_manifest` exposes conditions, inputs, recovery actions and host/transport limits. The installed Skill provides a short routing table without asking the model to reread a manual each step.


The single local Bridge has distinct Agent and desktop tokens, loopback-only socket, Host/Origin checks, bounded JSON, event streams and waits, and per-owner access checks. Only Agent routes accept the agent token; desktop state, event delivery and human decisions require the desktop token. `src/local/host-activity.mjs` exposes recent authenticated calls with **caller-declared** host labels (not verified application identity).

## Coordinates, scenes and rendering

Global coordinates are Electron **device-independent pixels (DIP)**. Displays may have negative origins. On Windows UI Automation, input is physical pixels; `src/native/calibration.mjs` requires matching monitor evidence before conversion. On macOS the native locator reads Accessibility's global logical coordinates. `src/visual/grounding.mjs` validates match provenance, recency and visibility; `src/visual/scene.mjs` owns templates, shapes, layered structure and atomic patches. `src/desktop/overlay-renderer.mjs` is the production SVG renderer; `scripts/build-overlay.mjs` generates the classic renderer for Electron; `npm run gallery` shares the production renderer.

Native targets are followed locally (default `followTarget:true`) until the session ends or manual scene editing takes ownership. If native evidence disappears, permission fails or the display layout changes, stale annotations are hidden; none of those transitions verifies the user's action. A scene update uses an `expectedRevision` to prevent stale writes.

## Build, installation and platform boundary

- Headless MCP: Node.js 22+, `npm ci --omit=optional`, `npm run verify`, `npm run test:integration`.
- Native desktop: optional Electron, `scripts/build-icons.mjs`, `scripts/build-native-macos.mjs` (macOS helper), `electron-builder.config.cjs`. CI builds unsigned macOS and Windows preview artifacts and tests packaged MCP stdio.
- macOS AX inspection and Windows UIA inspection require permission and **real-device** verification. Windows UAC secure desktop, cloud-only Agents, managed Wayland desktops and protected app surfaces are not guaranteed targets.
- No signing, notarization, auto-updater, remote desktop tunnel, automatic click or screen recording is part of the current tested release.

## Change map

| Task | Authoritative module | Checks |
|---|---|---|
| Session, ownership, user feedback | `src/core.mjs`, `src/local/interaction-journal.mjs` | `test/core.test.mjs`, `test/interaction-journal.test.mjs` |
| MCP, broker, security | `src/mcp.mjs`, `src/bridge.mjs`, `src/runtime.mjs` | `npm run test:integration`, `test/bridge.test.mjs` |
| AX/UIA, DPI, live tracking | `src/native/`, `native/{macos,windows}/` | `test/anchor-tracker.test.mjs`, `test/calibration.test.mjs`, real `docs/DESKTOP_QA.md` |
| Desktop design and scene patches | `src/desktop/`, `src/visual/` | `npm run gallery`, `npm run scene:lint`, `test/visual-renderer.test.mjs` |
| Host install / configuration | `src/config.mjs`, `src/host-install.mjs`, `integrations/` | `test/config.test.mjs`, `test/connector.test.mjs` |
| Installer | `electron-builder.config.cjs`, `.github/workflows/` | packaged MCP smoke + clean-install desktop acceptance |

See [Codex handoff](CODEX_HANDOFF.md), [security](SECURITY.md), [compatibility](COMPATIBILITY.md) and [desktop acceptance](DESKTOP_QA.md).
