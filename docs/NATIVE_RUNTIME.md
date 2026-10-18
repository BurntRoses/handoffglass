# Native Desktop / UI Locator Integration (v0.6 engineering preview)

## The two independent runtime tracks

**Developer/CLI track:** MCP stdio `src/mcp.mjs` runs on local Node.js 22+. On demand it starts the existing singleton Node broker, which invokes Electron for the desktop surface. This retains the original v0.5 workflow.

**Installed desktop track:** `src/desktop/app.mjs` is the Electron application main. It starts the loopback broker **in the desktop process** and writes the same owner-only `~/.handoffglass/broker.json` manifest as the Node broker. Other MCP/CLI clients can attach to it. End users launching the desktop do not need a separate Node.js binary for the desktop. When the installed app is packaged with the MCP entry, compatible hosts can use its Electron binary with `ELECTRON_RUN_AS_NODE=1` and `.../resources/app.asar/src/mcp.mjs` as the stdio entry (menu: Copy MCP configuration). A system Node.js checkout is an alternative. This relies on the Electron run-as-Node fuse and must be tested against each installed artifact.

Only one broker may be active per OS user. If a source broker is active when the desktop GUI is started, the GUI explains the conflict and exits rather than serving competing sessions. One startup lock coordinates creation; stale manifests are probed and replaced only when not live.

## Native Accessibility adapters

- **macOS:** `native/macos/locate.swift` uses ApplicationServices `AXUIElement`, `AXIsProcessTrusted`, `NSWorkspace.frontmostApplication`, AX role/title/description/frame and center-point hit test. Compile via `npm run native:macos`; the unsigned helper must be separately authorized by the user in System Settings. No screenshot, text field value, typed keys, click, approval or OS privilege escalation.
- **Windows:** `native/windows/locate.ps1` runs Windows PowerShell with .NET UIAutomationClient in a child process; searches only the foreground process's ControlView tree and returns rectangles in **physical pixels**. `src/native/locator.mjs` maps physical bounds using Electron's per-display `screen.dipToScreenRect` evidence into global DIP. It fails closed if the target lies outside current monitor mappings. Do not run elevated or through UAC secure desktop.
- **Linux:** native UI control lookup intentionally reports `unsupported_platform`. GNOME/KDE Wayland does not expose an equivalent unrestricted, compositor-independent global Accessibility API; keep the coordinate-only / human handoff fallback.

Both helpers: max 600 nodes and depth 8; max 64 matches; enforce a process timeout; single requested name and role only. Ambiguity, mismatched foreground app, occlusion, stale observations, missing OS permissions and unavailable displays are errors. No blanket tree dump is exposed to the model.

## Opt-in and privacy

Inspection is **disabled by default**. Enable locally with the tray/menu checkbox or `node scripts/accessibility.mjs on`. `HANDOFFGLASS_ENABLE_ACCESSIBILITY=1` is a development/test override. Only a `{version:1,consent:true}` in a user-only `accessibility.json` enables it normally. This setting means the app *may inspect a specifically requested control*; it does not grant Accessibility OS permissions, which are controlled by the OS. Disable with the menu or `node scripts/accessibility.mjs off`. Do not put sensitive UI text, screenshots, credentials or control values in application logs or persisted sessions.

## Agent procedure

1. Prefer `screen_displays`, then `handoff_request` without a target if no grounded position is available.
2. After consent, call `ui_locate({target:{app,role,name}})` **only for an exact control in the foreground application**. App is localized app name on macOS and process name without `.exe` on Windows.
3. Prefer directly calling `handoff_request({title,message,target:{app,role,name}})` so lookup and annotation occur in one broker operation (smaller staleness window). Do not supply both `target` and explicit coordinates/scene.
4. The user may click, decline, or cancel. A `completed` response is **only a user report**, never verification of the downstream action. Check the original application again.
5. If lookup fails, do not fabricate coordinates or retry endlessly. Use coordinate-free human guidance.

## Package engineering preview

`npm run native:macos` then `npm run build:desktop` on macOS; `npm run build:desktop` on Windows. Uses pinned electron-builder 26.0.12 (downloaded as a build-time tool by npx). The unpacked package is checked by `scripts/verify-package.mjs`; CI builds are **unsigned** and are not proof of real GUI performance. For a distributable archive run `npm run dist:desktop` on the target OS; then `npm run verify:dist` produces `dist/SHA256SUMS.txt`. The CI uploads unsigned macOS ZIP, Windows assisted NSIS installer and Windows Portable EXE engineering previews.

Signed/notarized builds, installed-binary launch tests, macOS hardened runtime/entitlements, Windows trust prompts and UI positioning evidence are pending real-machine QA. See `docs/DESKTOP_QA.md` and GitHub Issues #1, #3 and #4.

## Official sources

- Apple: https://developer.apple.com/documentation/applicationservices/1459186-axisprocesstrustedwithoptions
- Apple: https://developer.apple.com/documentation/applicationservices/1462077-axuielementcopyelementatposition
- Microsoft: https://learn.microsoft.com/en-us/windows/win32/api/uiautomationclient/nf-uiautomationclient-iuiautomation-elementfrompoint
- Electron: https://www.electronjs.org/docs/latest/api/screen
- electron-builder: https://www.electron.build/v26/docs/contents/

### MCP without a system Node installation

On a stable installed desktop binary, choose tray/menu > **Copy MCP configuration**. Paste the generated `mcpServers.handoffglass` into Claude/Cursor/Cline/Windsurf configuration. It points to the bundled Electron executable and `app.asar/src/mcp.mjs` with `ELECTRON_RUN_AS_NODE=1`. Codex needs equivalent TOML values. **Windows Portable EXE may unpack to a temporary path**; use a stable installed location for reliable host startup. `scripts/packaged-mcp-smoke.mjs` is run in CI to actually perform the MCP initialize/list-tools exchange using the packaged binary.
