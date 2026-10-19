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

## Native locator + packaged application acceptance (v0.6)

**Do not close this checklist solely from CI.** Unsigned packages are engineering previews.

1. Install/start the packaged GUI by itself: verify the local broker appears in `npm run broker:status` without a pre-existing Node broker. Quit and relaunch, check stale manifest recovery.
2. Connect a Claude / Codex / Cursor / VS Code MCP client and call `screen_displays`; verify one shared broker, not duplicated overlays.
3. Keep native inspection disabled: call `ui_locate` and require `consent_required` (no OS prompt or screenshot).
4. Open menu/tray, explicitly enable UI inspection. On macOS authorize the **helper executable** in System Settings > Privacy & Security > Accessibility. On Windows test a normal non-elevated application. Never elevate the helper.
5. With a synthetic app window foreground, locate `{app,role,name}` with unique control; verify exact matched rectangle and `global_DIP` coordinates. Change DPI, move monitors (including a negative coordinate), and repeat.
6. Duplicate names, hidden/disabled control, covered control, other-application foreground, closed target, permission denial and secure desktop must all fail safely.
7. Call `handoff_request` with `target`, confirm visual position; move target mid-flight and verify stale guidance is not silently treated as confirmed success.
8. Verify click-through, window focus retention, overlay and panel never block the target; test ability to reopen hidden panel using tray menu.
9. On Windows compare UIA physical pixels to DIP; test mixed 100% / 150% DPI with different primary monitor. On macOS test multiple Spaces, full-screen applications and Accessibility helper permissions after reinstall.
10. Save redacted evidence and versions. CI validates build structure, not any of steps 1–9.

## Live anchored target validation (v0.14)

On macOS and Windows with explicit Accessibility opt-in, verify each with the **actual foreground application**:

1. Request an exact-match `target` using `handoff_request`, then move the window. The highlighted target should follow within one polling interval (nominal 2.5s), without opening a new handoff or changing its deadline.
2. Hide the target or switch to a different foreground application. The overlay must remove the stale highlight; the user decision panel must remain and must not claim task completion.
3. Bring the original target back. The mark should reappear only after a successful fresh native observation.
4. Rearrange or hot-unplug a monitor. The old mark must disappear immediately when the new layout reaches the Broker; require a new location result before showing marks.
5. Repeat on mixed DPI Windows monitors and macOS multiple Spaces. Denied OS permissions, `followTarget:false`, expired and superseded sessions must be tested separately.
6. Record screen video and measured drift/latency on a **non-sensitive mock application**. Synthetic Node tests do not establish real UI performance.
