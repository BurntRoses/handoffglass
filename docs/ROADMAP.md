# Engineering roadmap

## v0.2 — implemented in source, functional tests

- [x] Official MCP TypeScript SDK v2 adapter and portable Skill.
- [x] Multi-annotation model (up to 8) and coordinate-free fallback handoff.
- [x] Immutable explicit session outcomes, expiry, superseding, user-report distinction.
- [x] Revisioned bridge snapshots, bearer and loopback checks, payload limits.
- [x] Transparent Electron overlay per display and clickable user decision panel.
- [x] Cross-display DIP coordinate transformation + geometry tests.
- [x] Unit/bridge tests; real MCP stdio smoke test script, desktop manual smoke script and CI configuration.
- [x] GitHub Actions verifies syntax, 16 unit tests and real MCP SDK stdio handshake on Linux/macOS/Windows.
- [ ] Desktop GUI acceptance on native macOS and Windows.

## v0.3 — make installation effortless

- [ ] Signed macOS app and notarization; Windows installer and packaging.
- [ ] Reliable single-instance broker across multiple MCP clients.
- [ ] Protocol version negotiation and typed event tracing (opt-in, redacted).
- [ ] Tray/status indicator and explicit kill switch; keyboard accessibility.
- [ ] Screen/DPI calibration wizard and automatic handling of display layout changes.

## v0.4 — actual grounded GUI targets

- [ ] macOS Accessibility / Windows UI Automation adapters.
- [ ] Browser DOM adapter with robust element identity and click-target refresh.
- [ ] Optional screenshot + vision fallback, opt-in, privacy-focused.
- [ ] `target` object using app/process/accessibility reference instead of x/y only.
- [ ] Revalidate element position before every visual hint; detect stale/occluded windows.

## v0.5 — richer collaborative tasks

- [ ] Sequential multi-step guides, partial completion, pause and back navigation.
- [ ] Optional voice and dynamic screen understanding based on UI change events.
- [ ] Remote-browser overlay adapter for cloud Computer Use sessions.
- [ ] Task-level resume tokens, integration harnesses for multiple Agent hosts.
- [ ] Human factors benchmark against text-only and full automation baselines.

## Do not claim yet

No automatic grounding, no universal protected-desktop access, no cross-device video live annotation, no app marketplace packaging, no production guarantees. A private source repository is not an installable signed application.
