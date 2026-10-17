# HandoffGlass roadmap

## v0.3 — multi-Agent runtime (implemented in source)

- [x] Single local Broker shared across MCP clients; startup lock and recovery from stale manifest.
- [x] Separate Agent and desktop bearer tokens; owner-scoped status/wait/cancel.
- [x] Reject cross-Agent superseding (`busy`) without asking a person to handle two simultaneous prompts.
- [x] Broker CLI status/stop, state recovery tests, dual-host MCP SDK integration script.
- [x] Electron display-change debounce and fresh desktop handshake on renderer restart.
- [ ] Cross-platform GUI desktop acceptance on macOS and Windows real interactive sessions.
- [ ] Signed installer, hardened macOS app, verified Windows installer and notarization.
- [ ] Stable public multi-runtime protocol (currently private v0.3 design, subject to change).

## v0.4 — authoritative UI targets

- [ ] macOS AXUIElement and Windows UI Automation adapters with a permission-gated capability surface.
- [ ] Browser DOM adapter, stale-target revalidation, ambiguous-match errors and visibility/occlusion checks.
- [ ] Privacy-safe sampling, bounding box proofs and explicit trust labeling.
- [ ] Optional screenshot/vision fallback only after opt-in and a data retention policy.

## v0.5 — richer human/Agent collaboration

- [ ] Multi-step guides, per-step outcome confirmations, explicit dismiss/decline policy and independent verification hooks.
- [ ] Keyboard-accessible screen reader semantics and internationalized visual layer.
- [ ] Chrome/cloud-browser overlays and optional speech events, avoiding a mandatory video stream.
- [ ] Agent-host extension samples; realistic task benchmark measuring success, time, human load and token cost.

## Deferred or unsupported

No automatic CAPTCHA solving, bypassing OS secure surfaces, guaranteed control of permission dialogs, automatic privileged approval or blanket claim of “production ready”.
