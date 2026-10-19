# Codex local development handoff

**Baseline:** HandoffGlass 0.15.0; private repository `BurntRoses/handoffglass`. This handoff was prepared against commit `9b06d207ee53a16bc73b94ae9dd58e96eb3cfa0b`. Always check `git rev-parse HEAD` before using these notes; newer commits and real observations take precedence.

## Objective / 目标

Move from headless protocol confidence to a desktop application that reliably guides a person through an actual task and lets the calling Agent continue. **Work on the installed application on a real Mac/Windows computer.** The product is local-first; do not add screen surveillance, cloud dependencies, parallel Agents or a second Broker to accelerate testing.

### Five-minute start on the user's Mac (Apple Silicon)

```sh
git clone https://github.com/BurntRoses/handoffglass.git
cd handoffglass
node --version                 # Node 22 or later
npm ci                        # desktop Electron included; requires network initially
npm run verify                # syntax, repository integrity, 126+ Node regressions
npm run test:integration      # actual MCP SDK client/server handshake
npm run connection:check      # independent local MCP initialization
npm run test:extras           # optional tool schemas and replies
npm run doctor                # local environment diagnostics
npm run desktop:demo          # real Electron UI: requires an interactive desktop
```

The `npm run verify` suite is **not** desktop acceptance. On first native inspection, explicitly enable read-only Accessibility in the HandoffGlass UI, check `npm run accessibility`, and grant access to the appropriate helper in macOS System Settings; do not silently prompt or script OS permission changes. Inspect console logs without leaking account content. Test with harmless mock windows, not real payment or authorization screens.

### Entry points and state ownership

```text
Agent desktop/CLI                   HandoffGlass (one OS account)
      │
      └─ stdio → src/mcp.mjs → src/runtime.mjs ── authenticated loopback ─┐
                                                                         │
                      src/broker.mjs → HandoffManager (one active session)│
                                │                  ↑                    │
                      src/bridge.mjs ───────────────┘                    │
                                │ separate desktop bearer              │
                      Electron src/desktop/main.mjs                     │
                       ├─ transparent, mouse-through overlays           │
                       ├─ human decision panel                          │
                       ├─ setup and Control Center                      │
                       └─ native locator via macOS AX / Windows UIA     │
                                                                         │
               Local preferences: user-owned, narrow, no operation log  ┘
```

Canonical descriptions: [architecture](ARCHITECTURE.md), [security](SECURITY.md), [scene protocol](SCENE_PROTOCOL.md), [interaction events](INTERACTION_EVENTS.md), [native behavior](NATIVE_RUNTIME.md). `docs/INDEX.md` is the document map.

### What is implemented — and what is not verified

| Capability | Implementation | Evidence still required |
|---|---|---|
| Owner-isolated MCP, single Broker, session state/events | Node tests; GitHub three-OS headless CI | Real host reconnection without crossing owners |
| Accessible target lookup, opt-in tracking and stale-target removal | macOS Swift / Windows UIA; deterministic tests | AX/UIA behavior, permissions, exact highlight drift on physical monitors |
| Electron desktop setup, Control Center, overlay, handoff panel | Source, simulated browser layout tests, packaged structural smoke | Click-through, focus, full-screen, display hotplug, HiDPI, normal quit/relaunch |
| Claude/Codex/Trae etc. MCP config generation | Generator and protocol tests | Each real client launching tools with correct working directory and executable |
| DeepSeek Cordis, WorkBuddy connector | Integration source and shape tests | Real host load and end-to-end human handoff |
| Unsigned macOS/Windows packages | GitHub Actions build/stdio checks | Clean install, app permissions, OS security warnings, uninstall; production signing later |
| Context-size savings | Synthetic compact vs normal response bytes | Actual model token accounting and task success/false-target baseline |

**Safety semantics:** `completed` remains `verified=false`; `handoff_events` reports cursor-based local state transitions, not proof of the downstream effect. New MCP clients never inherit the previous process's owner identity. Do not solve reconnection by making sessions globally claimable.

## Work order — concrete experiments

**P0 · One end-to-end Codex scenario, then fix failures.** Connect the real local Codex CLI/desktop client via generated configuration (`node scripts/configure.mjs codex`), trigger a synthetic `handoff_request`, select Complete and Decline in separate runs, then verify agent-side `handoff_events` and independent task state. Record tool arguments, scrubbed responses, session/owner semantics, and whether actual overlay appeared. Refuse unsupported privileges.

**P0 · Native geometry and trust.** On macOS AX first (the primary development machine), exercise an exact role/name target; move/resize, switch apps, hide/show control, change Space, deny/revoke permission and move a secondary screen left of the primary. Measure target drift and recovery latency on video **without private UI**. On Windows repeat with 100% / 150% mixed scaling. Fix source of coordinate error, not a compensating magic offset.

**P0 · Desktop UX.** Confirm transparent overlays pass mouse events through and never trap focus; panel always has a reachable Decline/Cancel path. Test dark/light, reduced motion, Chinese/English/Japanese copy, switching displays and Electron restart. Compare actual app screenshot with `site/` demo only as a visual reference.

**P1 · Real Harness adoption.** Install and run DeepSeek Harness, WorkBuddy, Trae, then Claude/Codex as relevant. Confirm actual tool calls in Control Center; note caller labels are configuration-supplied, not authenticated client identity. Do not mark unsupported hosts as compatible merely because MCP JSON can be emitted.

**P1 · Distribution.** Build unsigned packages with `npm run dist:desktop`, run `npm run test:packaged` where applicable, inspect upgrade/reinstall, packaging resources, signatures and first-run gating. Do not publish a production binary until signing/notarization and acceptance pass.

**P2 · Measured efficiency.** On a fixed, repeatable task set compare text-only, static mark and tracked HandoffGlass handoffs. Record wall time, tool calls, model token usage, correct targets, refusals and downstream verification. Reject token savings that increase false guidance.

Primary issue tracker: [#1 desktop QA](https://github.com/BurntRoses/handoffglass/issues/1), [#3 native targeting](https://github.com/BurntRoses/handoffglass/issues/3), [#4 distribution](https://github.com/BurntRoses/handoffglass/issues/4), [#9 Harness E2E](https://github.com/BurntRoses/handoffglass/issues/9), [#10 efficiency](https://github.com/BurntRoses/handoffglass/issues/10).

## Reproducible QA record

Use one entry per executed experiment, in the PR or corresponding private Issue; avoid creating a growing repository log for every test.

```text
Host/OS:           macOS version / Windows build, CPU, Electron version
Build:             git SHA, source vs installer, Node version
Environment:       displays, scaling, foreground app, AX/UIA permission
Scenario:          exact non-sensitive reproduction steps
Expected / actual: behavior, coordinates when not sensitive, status + error codes
Evidence:          redacted video or screenshot location (private, no secrets)
Tests:             exact commands and pass/fail counts
Disposition:       fixed / reproduced / blocked and next action
```

## Completion criteria

- Work on a branch; submit small, reproducible PRs rather than a large rewrite. `npm run verify` and full MCP tests pass, and relevant real GUI scenarios pass on the operating system touched.
- No credentials, user screen contents, app-data directories or generated Electron executables committed. `.gitignore` intentionally excludes build outputs.
- Explain measured impact and remaining limitations; update `docs/DESKTOP_QA.md` only with genuine device observations. Keep private bugs and evidence in private Issues.
- Preserve the owner/bearer boundary, OS consent and the human decision contract in all fixes.
