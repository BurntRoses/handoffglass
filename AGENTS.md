# Instructions for autonomous coding agents

Work on this repo as an MCP desktop handoff infrastructure project, **not** a GUI-clicking automation bot. Read `docs/AGENT_HANDOFF.md` before modifying source.

## Non-negotiable invariants
1. Never invent UI coordinates, grant a permission, solve a challenge, or approve a payment on the user's behalf. The human makes sensitive decisions.
2. A human pressing *completed* reports an action; it does not prove downstream success (`verified` remains false).
3. Keep the local broker bound to loopback, require scoped bearer credentials, forbid browser origins, and preserve owner-scoped status/cancel.
4. Do not introduce screen capture, OCR, accessibility enumeration, telemetry or cloud calls silently; obtain explicit consent and define retention/redaction before implementation.
5. On GUI loss, return a clear error rather than claiming the visual overlay appeared.
6. Preserve MCP tool names and response fields or document and version any breaking changes.
7. No modifying real user settings, login/payment/security prompts in test automation.

## Before changing code
- Inspect `src/core.mjs` (authoritative state machine), `src/bridge.mjs` (loopback transport), `src/runtime.mjs` (broker discovery/ownership), `src/mcp.mjs` (public tools), and `src/desktop/` (Electron UI).
- Run `npm ci`, `npm run verify`, `npm run test:integration` (Node 22+). CI matrix must pass on Ubuntu, macOS, Windows.
- Prefer an isolated branch/PR for nontrivial changes; include regression tests and state what was not tested.
- Do not close desktop acceptance issues using only headless CI results.

## Definition of done
- New behavior has success, refusal, timeout, cancellation and stale-state tests where applicable.
- Platform limitations, privacy/security implications and manual steps are documented.
- No secrets, screenshot captures or user-specific file paths are committed.
- All passing claims cite exact commands and CI runs; failed tests are not hidden.

## v0.4 cross-platform rules
- Use `src/config.mjs` and `scripts/configure.mjs` for all MCP host configuration variants. Do not add a new runtime just for another AI model.
- Maintain `requestId` and the default MCP output structure. Compact mode is opt-in and must retain status and `verified`.
- Electron is optional. Core/headless CI must run under `npm ci --omit=optional`.
- Panel acknowledgements must come from the broker, not from timeouts or arbitrary renderer state.
- See `docs/COMPATIBILITY.md` and `docs/MODEL_PLAYBOOK.md` for tested vs documented host integrations.
- Keep `scripts/install-host.mjs` dry-run by default, conservatively merge existing JSON config and never automatically alter a host's TOML/JSONC. Use explicit `--apply` and backup for file mutations.

## Scene v1 (v0.5+)
- Read `docs/SCENE_PROTOCOL.md`, `docs/VISUAL_LANGUAGE.md` and `docs/PRODUCT_INTERACTIONS.md` before touching annotations or desktop overlay.
- Pure scene semantics and templates belong in `src/visual/scene.mjs`. Do not duplicate rules in each MCP harness or DOM renderer.
- Gallery (`npm run gallery`) imports the **production** SVG renderer. Update both the protocol tests and gallery when adding marks or templates.
- Preserve owner-scoped optimistic `visual_scene_update` with no TTL reset or user-decision spoofing. Legacy six tool names remain stable.
- Every new scene shape needs renderer tests, schema changes, documentation and an actual screen-oriented QA scenario.

## v0.6 platform rules
- Desktop GUI packaged entry: `src/desktop/app.mjs`; source MCP client: `src/mcp.mjs`; native locator: `src/native/locator.mjs` and `native/{macos,windows}`.
- Native targeting **requires explicit user opt-in**; never bypass accessibility permissions or fake a UI location.
- macOS AX is global logical desktop coordinates; Windows UIA uses physical pixels and must use explicit monitor evidence for conversion to global DIP.
- Do not claim packaged binaries work on a user desktop until `docs/DESKTOP_QA.md` has genuine evidence. CI-only structural packaging is not GUI acceptance.
- Linux/Wayland and remote host/container sessions are not automatically supported. Prefer coordinate-free human handoff when no reliable locator is available.

## v0.7 local-first and native harness integration
- Read `docs/LOCAL_FIRST_MEMORY.md`, `docs/VISUAL_MOTION.md` and `docs/CHINA_HARNESS_INTEGRATION.md`.
- WorkBuddy connector source is `integrations/workbuddy/`; generator must resolve absolute local paths only at installation, never commit developer-specific paths or publish machine-local connectors.
- DeepSeek Harness Cordis adapter is `integrations/deepseek-harness/src/plugin.ts`, loaded from a real cloned DSH checkout with `scripts/prepare-deepseek.mjs`. Treat it as *developer preview* until tested on DSH; do not assert full runtime acceptance based on shape tests.
- The user manages preferences. An Agent cannot write to long-term memory, capture history, grant permissions, or override OS reduced-motion requirements.
- Do not add MCP tools by default that expand the model schema. Optional local context/blueprints are behind `HANDOFFGLASS_EXTRAS=1`.
- Strong visual design is subject to accessibility: never hide a risk/decline action behind animation, blur or spotlights.

## Autonomous policy & readiness (next)
- Read `docs/AGENT_AUTONOMY.md` before integrating or advertising automatic handoff tool use. Avoid overlay spam; trigger only when ordinary action fails or a human decision is needed.
- The optional `handoff_assess` tool is pure and read-only; never silently enable all extras on small-context hosts.
- Run `npm run readiness -- --json` to collect an environment readiness report, not a GUI acceptance certificate.
- The Windows packaged MCP smoke may need bounded cleanup retries after the Electron child exits. Do not bypass smoke failure assertions.

## Shared UI tokens and appearance
- Desktop setup and handoff panel share `src/desktop/ui-tokens.css`; adjust tokens instead of adding unbounded duplicated colors.
- Local preference `theme: system | dark | light` is user-owned, with backward-compatible defaults.
- Use safe textContent and localized copy; never render host-supplied HTML. Test dark/light/reduced-motion/forced-colors before UI claims.
- See `docs/INTERFACE_SYSTEM.md` for design and IPC rules.

## v0.12 self-test and support-report contract
- `npm run connection:check` launches an isolated, headless MCP child and sends initialize/tools/list/screen_displays only; it never validates that an external host registered a tool.
- Control Center IPC for connection test, display geometry and support report must remain sender-bound; no caller-provided command execution or sensitive data in a report.
- Keep `docs/CONNECTION_DIAGNOSTICS.md` and `test/mcp-probe.test.mjs` up to date.

## v0.13 activity and geometry invariants
- Host activity shows authenticated *tool invocations* with caller-declared host labels; not signed host identity or a live socket count. Never persist requests, prompts, paths, passwords or raw owner IDs.
- A rechecked UI target may move or the display signature may change. Fail closed on cross-screen physical rectangles. `locationVerified` must never be treated as a downstream action success.
