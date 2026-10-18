# Code Agent implementation handoff — 2026-10-17

## Mission / project boundary
HandoffGlass is a local-first capability for **existing** AI agents to show a visually grounded hint, ask a person for a decision, then resume only after the agent independently verifies the downstream app. It is an MCP server + optional Agent Skill + Electron overlay. Do not build a general-purpose autonomous clicking assistant.

## What is implemented
- MCP TypeScript v2 stdio server: `src/mcp.mjs`, six tools: `screen_displays`, `visual_show`, `handoff_request`, `handoff_status`, `handoff_wait`, `handoff_cancel`.
- Shared on-demand broker: `src/broker.mjs`; discovery + startup lock: `src/runtime.mjs`; two separate local bearer capabilities and owner IDs.
- Local HTTP IPC bridge and display geometry: `src/bridge.mjs`, `src/geometry.mjs`; at most one active handoff across agents.
- Electron overlay/panel: `src/desktop/`; manual demo: `npm run desktop:demo`.
- `src/core.mjs` is the sole source of truth for session status. `completed` means `completionSource=user_report` and `verified=false`.
- Headless integration test launches **two** real MCP stdio clients against the shared broker.

## Local setup and reproducible checks
```
git clone https://github.com/BurntRoses/handoffglass.git
cd handoffglass
node --version  # >=22
npm ci
npm run verify
npm run test:integration
npm run doctor
npm run desktop:demo   # interactive desktop required
```
See `docs/DESKTOP_QA.md` for physical-device checks. Headless CI cannot validate always-on-top overlays or operating-system secure surfaces.

## Architecture & trust boundaries
Agent host → `stdio` MCP → per-host `BrokerClient` with UUID → single loopback broker (`127.0.0.1`, random port) → Electron desktop. Manifest with agent token lives in a user-private runtime directory. Desktop has a distinct token. No listening on a public interface and no CORS. An Agent cannot cancel someone else's active handoff. Renderer displays a *snapshot/revision*, not a replay of queued stale commands.

Avoid assuming all local processes of the same OS user are isolated from each other. Bearer tokens in same-user readable memory/config cannot defend against a malicious same-user process. Future threat modelling should explicitly cover compromised Agent tool process and desktop renderer.

## Next tasks, in order

### P0 — native interactive acceptance, Issue #1
Run in physical macOS and Windows sessions. Confirm click-through and focus preservation, panel button keyboard navigation, multi-display including negative DIP origins, DPI scaling, fullscreen/Spaces, window changes, restarts, broken desktop, and secure desktop limitation. Record OS/Electron versions; redact screenshots. Add regression tests where automated equivalents exist. Do not mark this done without real GUI evidence.

### P0 — proper packaging, Issue #4
Produce *unsigned*, clearly labeled macOS/Windows installation artifacts through GitHub Actions, artifact smoke tests and release documentation; reproducible `npm ci` already exists. **Do not** claim signed/notarized installers until credentials exist. Decide package runtime strategy first: an installed Electron app must not depend on ephemeral source-tree paths for broker/node entry points.

### P1 — UI accessibility grounding, Issue #3
Design an adapter contract with `locate({app, role, name}) -> {candidates, bounds, timestamp, coordinateSpace, provenance}`. Implement macOS AX / Windows UIA with explicit permission and runtime revalidation. Return ambiguity/staleness as errors; never guess. Keep sensitive UI strings local. Include DPI, covered-window, offscreen, renamed-element tests. Only then add a `visual_target` tool or optional target field.

### P1 — privilege model review
Audit token exposure to child processes, manifest atomics and Windows file permissions, polling resource limits, and lifecycle when an MCP client exits. Document threat model, including same-user processes, OS secure-desktop boundaries and remote-browser coordinates.

### P2 — Agent integration benchmark
Write repeatable tasks in a synthetic app: permission-like choice (not real permissions), form input, error recovery and deliberate rejection. Measure time, prompt tokens, erroneous approvals, task completion and handoff latency. Compare to text-only instruction baseline.

## Relevant entry points and tests
- Session expiry, conflict, user choice: `src/core.mjs`, `test/core.test.mjs`.
- IPC auth, reconnect and method validation: `src/bridge.mjs`, `test/bridge.test.mjs`.
- Broker concurrency and restart: `src/runtime.mjs`, `test/runtime.test.mjs` (inspect actual test names under `test/`).
- Real MCP SDK integration: `scripts/mcp-smoke.mjs`.
- Desktop manual QA: `docs/DESKTOP_QA.md`.
- Public tool prompts and instructions: `skills/visual-handoff/SKILL.md`.

## Scope limits and red flags
- CAPTCHA / MFA human handoff is allowed; never implement an automated bypass.
- Do not claim support for Windows UAC secure desktop or password-manager protected UI without verified evidence.
- Do not equate a click with verified success.
- Do not silently capture screenshots or ship telemetry.
- Keep docs honest: not a production-ready GUI release yet.

## 2026-10-18 update: v0.4 lightweight and harness work

The repository's canonical design is now **one local MCP stdio server + one broker + optional Electron**. Do not create seven per-harness implementations. In particular:

- `src/config.mjs` is the single source of truth for seven host configurations; `scripts/configure.mjs HOST [--compact]` prints merge-ready JSON or TOML. Examples and documented config paths: `docs/COMPATIBILITY.md`.
- `src/output.mjs` implements opt-in compact results, preserving the default JSON contract. `docs/MODEL_PLAYBOOK.md` explains prompting budgets without coupling to proprietary models.
- `src/core.mjs` supports owner-scoped `requestId` deduplication and bounds concurrent waits to 64. Conflicting reused IDs are rejected. Broker POST retries without a request ID are deliberately *not* automatic.
- `src/desktop/` now sends **acknowledged** decisions; plain `visual_show` should have no blocking panel; spotlight masks should be composed, not stacked. Physical desktop validation is still required.
- `package.json` has optional Electron; CI uses `npm ci --omit=optional` (headless protocol checks, no expensive GUI download). To test actual desktop UI install optional Electron and run `npm run desktop:demo`.
- Run `npm run verify`, `npm run bench:broker` and `npm run test:integration` in CI. The synthetic benchmark **does not** establish real-world latency.

Next highest-value tasks remain native GUI acceptance, packaging, and opt-in, privacy-limited macOS AX / Windows UI Automation provider. Do not claim these are complete based on mock or headless test results. Issue #1, #3 and #4 remain open by design.

### Optional host-config installer (v0.4 follow-up)

`src/host-install.mjs` merges known JSON host schemas conservatively. `scripts/install-host.mjs` previews by default and requires explicit `--apply`; it creates 0600 backups and atomically writes JSON. Existing HandoffGlass stanzas require `--replace`. Do not change installer semantics to silently overwrite JSONC, TOML or unrelated host servers. Real-host launch verification remains separate from config-shape tests.
