# Desktop acceptance checklist — macOS / Windows

**Not a CI result.** Complete this on real graphical desktops before tagging a production release.

Record OS version, processor architecture, Electron version, display resolution and DPI scaling, accessibility permission state, and exact steps for each failure. Do not upload identifiable screenshots.

- [ ] `npm install && npm run desktop:demo` opens one click-through overlay per display and a clickable control panel.
- [ ] Mouse and keyboard reach the underlying app when the overlay is shown; the guide never types or clicks itself.
- [ ] User selecting Complete / Decline / Cancel returns the exact session ID and terminal status.
- [ ] Multi-display: one screen to the **left** of the primary has negative global coordinates.
- [ ] Change display scale, disconnect secondary monitor, and reattach it; no stale arrows or offscreen panel remain.
- [ ] Full-screen app / macOS Spaces behavior is captured with limitations explained.
- [ ] Windows UAC secure desktop and macOS privileged prompts are tested only to **document unsupported behavior**, not to bypass protections.
- [ ] Close or crash the desktop renderer; a subsequent Agent request restores it without an obsolete overlay.
- [ ] Start two MCP clients simultaneously; second receives `busy` and cannot cancel the first host's session.
- [ ] Stop the broker with `npm run broker:stop`; new MCP request starts a fresh broker without inheriting previous sessions.
- [ ] Verify actual app change using independent application tools, not the human's “completed” selection alone.
- [ ] No secret-bearing logs or screenshots are uploaded to public CI artifacts.

## Recommended evidence

Redacted screenshots/videos, environment versions, checklist pass/fail, reproducible failures as private GitHub Issues. This desktop QA step cannot be replaced by passing headless GitHub Actions.
