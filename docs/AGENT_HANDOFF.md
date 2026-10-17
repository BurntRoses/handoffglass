# Independent Code Agent handoff (2026-10-17)

## Product
HandoffGlass provides existing AI agents a **visual, human-controlled handoff** when they cannot or should not directly operate a desktop UI. MCP server + local single-instance broker + optional transparent Electron overlay and Agent Skill. It is not a standalone AI assistant or automatic consent agent.

## Verified baseline
- `main` previously passed three-platform CI, 22 Node tests and a dual-MCP-client handshake.
- This patch adds explicit route-method checks, a cap on pending long polls and 2 regression tests (24 total in local Node 22 verification).
- **No physical GUI acceptance has yet been performed**; do not claim normal Windows/macOS app reliability.

## Architecture & entry files
`src/mcp.mjs`: MCP TypeScript v2 stdio tools (`screen_displays`, `visual_show`, `handoff_request`, `handoff_status`, `handoff_wait`, `handoff_cancel`).
`src/runtime.mjs`: owner UUID per MCP host, broker discovery/startup lock.
`src/broker.mjs`: shared broker lifecycle, Electron spawn.
`src/bridge.mjs`: localhost-only authenticated HTTP IPC; separate agent and desktop secrets.
`src/core.mjs`: single active session, terminal states, user reporting.
`src/geometry.mjs`: global desktop DIP display geometry.
`src/desktop/`: Electron transparent overlay and action panel.
`scripts/mcp-smoke.mjs`: two real MCP clients against one broker.
`docs/DESKTOP_QA.md`: human desktop testing plan.

## Build, test, and run
```sh
git clone https://github.com/BurntRoses/handoffglass.git
cd handoffglass
node --version # 22+
npm ci
npm run verify
npm run test:integration
npm run doctor
npm run desktop:demo # real graphical desktop session required
npm run configure    # MCP connection examples
```

## Strict product and security constraints
- Users—not Agents—decide on MFA, permissions, payment and protected dialogs; never bypass security controls.
- A user's `completed` button is not proof the external app accepted the action; independent post-handoff checks are required.
- Agent ownership protects concurrent flows; ensure one agent cannot cancel another's session.
- Remain local-first; no telemetry or screenshot collection without opt-in/privacy policy. Agent token accessible to same-user processes is **not** a defense against a malicious compromised same-user process.
- Never promise overlays over secure desktops/UAC or inaccessible protected UI.
- If a target is ungrounded, request coordinate-free handoff; do not guess a bounding box.

## Priority worklist with acceptance

### P0 — Issue #1: physical desktop QA
On actual macOS and Windows, verify keyboard focus, mouse click-through, control panel response and exact session ID/status, monitor negative origins, DPI, Spaces/fullscreen, window moves, relaunches, and secure-desktop limitations. Record OS/Electron versions and redacted evidence. Headless GitHub Actions does not replace this.

### P0 — Issue #4: packaging and release
Build unsigned macOS and Windows artifacts in CI, test launching packaged binaries, document unsupported signing. `npm ci` and lockfile exist. Explicitly design packaged Node/broker runtime; source-tree paths may not survive Electron packaging. Do not label unsigned artifacts as trusted installers.

### P1 — Issue #3: grounded UI element targeting
Introduce a permission-gated adapter contract: `locate({app,role,name}) -> {candidates,bounds,timestamp,coordinateSpace,provenance}`. macOS AXUIElement and Windows UI Automation; browser DOM may be a separate adapter. Do not guess if ambiguous/stale/offscreen. Revalidate before rendering; protect sensitive AX/UIA text.

### P1 — security threat model
Test broker startup races, IPC resource limits, same-user process threat boundaries, Windows runtime file permissions, abandoned clients and UI crash handling.

### P2 — benchmark + adoption
Synthetic app for handoff, deliberate rejection, error recovery. Compare visual guidance vs text instructions on task success, user load, elapsed time, token usage and erroneous approvals. Include integration recipes for Codex, Claude and other MCP hosts.

## Definition of done
A PR needs tests + migration/safety notes + precise CI evidence. Do not close a GUI testing issue on Node tests alone. No secrets or screenshots in commits. Document limitations and deferred tasks.
