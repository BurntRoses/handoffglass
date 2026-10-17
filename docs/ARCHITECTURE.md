# HandoffGlass Architecture — v0.2

## Purpose

Reusable Visual Handoff runtime that any compatible Agent can invoke as MCP tools. It is intentionally separate from autonomous Computer Use, model inference and remote browser automation. The local runtime presents the next human action and reports the user's response, but does **not** prove actual task success.

## Process boundaries

1. **Agent host:** sends MCP JSON-RPC to `src/mcp.mjs` over stdio. stdout is protocol-only, diagnostics go to stderr.
2. **MCP adapter:** tool schemas use MCP TypeScript SDK v2 + Zod v4. It performs argument validation and invokes `HandoffManager`. An operating-system overlay can be launched on the first UI request.
3. **Coordinator:** `src/core.mjs` validates annotations (up to 8), holds a single active session, replaces the previous active session atomically, generates random UUIDs, expires timers, bounds terminal history and returns defensive snapshots.
4. **Bridge:** `src/bridge.mjs` binds to 127.0.0.1 and selects an ephemeral port. A random bearer token is passed **only** to the Electron main process. It rejects non-loopback Host headers, browser Origin headers and invalid Content-Type. It exposes `/hello`, `/state`, `/poll?after=N`, `/decision`.
5. **Renderer:** Electron main process builds one transparent click-through `BrowserWindow` per display with a separate clickable action panel. `preload.cjs` exposes only `onRender` and `decide`; renderers are sandboxed, context-isolated and cannot use Node. No arbitrary URLs are loaded.

## Session model

`idle → awaiting_user → completed | declined | cancelled | expired | superseded`

A subsequent `show()` changes the old session to `superseded` before announcing the new one. Completion is reported by the user (`completionSource=user_report`) and deliberately always has `verified=false`. Actual verification is delegated back to the caller. All terminal states are immutable. A timeout fires even if the UI disappears or the Agent stops polling.

## Bridge change synchronization

The v0.1 queue could replay stale `show` messages after a desktop reconnection. v0.2 uses **monotonic revisions plus current snapshots**. The UI sends `after=revision` when polling. On reconnect, `/hello` returns the current `active` state; obsolete intermediate events cannot resurrect an old arrow. Long-poll waiters are released on any state transition. In a future multi-client design, revisions need to be scoped to an explicit session owner.

## Screen coordinate system

Electron uses global **device-independent pixel** (DIP) coordinates for BrowserWindow bounds. Each annotation is mapped into its display's local coordinate system. Negative global origins are valid on a left-hand secondary monitor. All targets must fit a known display, otherwise the MCP tool fails. A screenshot produced with physical pixels, zoom or resizing must be calibrated before these coordinates are usable. Multiple monitors and Retina scaling need real OS verification.

## Currently out of scope

- Built-in GUI grounding from accessibility or vision models, screenshot capture, system-wide clicks and keystrokes.
- Full human/Agent work orchestration or multi-host arbitration.
- Remote browser video annotation and persistent session recovery.
- Secure OS desktops and permissions dialog variants that ordinary windows cannot overlay.
- Cross-platform production installers, code signing, notarization.
- Model inference, media streaming or continuous multimodal video.

## Planned adapters

`MCP Adapter → Presentation Model → Electron/Native/Browser Renderers`, with optional separate `Accessibility Target Resolver` and `Computer Use Verification Adapter`. The protocol should continue to support coordinate-free handoffs even when all grounding adapters fail.
