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
