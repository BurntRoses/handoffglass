# Local connection & display diagnostics

HandoffGlass uses a real, isolated MCP check to answer one narrow question: **can the current local installation start the stdio server, negotiate MCP, expose its expected tools and perform a headless display query?**

Open **HandoffGlass → Help → Local service check**. An independent headless MCP process uses a temporary private runtime directory and is terminated after the check. It cannot see your current handoff, approve a dialog or access the native UI locator. The check uses only `initialize`, `tools/list` and `screen_displays`.

For a source checkout:

```sh
npm ci
npm run connection:check
npm run readiness -- --json
```

The check returns `hostVerified:false`, even on success. The connection wizard separately matches successful calls to the installation ID in that host configuration, retaining evidence in memory for fifteen minutes. Host identity remains caller-declared; see [Host activity](HOST_ACTIVITY.md). A working local MCP executable does not prove that Claude, Codex, DeepSeek Harness, WorkBuddy or another host has installed its configuration. In the host, refresh tool discovery and confirm `capability_manifest`, `session_start`, `session_wait`, `integration_status`, `integration_cleanup` and `integration_uninstall` appear; then call `connection_status` once. No sensitive action is needed.

## Error recovery

| Code | What happened | Next action |
| --- | --- | --- |
| `launch_failed` | MCP process did not start | Verify installation location and executable permissions |
| `process_exited` | Process ended before handshake | Run `npm ci` for source install, then retry |
| `timeout` | Handshake or headless query timed out | Check endpoint-security restrictions and restart the local app |
| `missing_tools` | MCP answered but required tools were absent | Check that the host points to the current HandoffGlass version |
| `protocol_mismatch` | Malformed or incompatible response | Upgrade/repair the local installation; inspect Node version |
| `handshake_failed` | Another protocol error | Run `npm run test:integration` in source checkout |

Do not copy Broker tokens, task logs, screenshot files or personal paths into bug reports. **Help → Details → Copy diagnostics** produces an allowlisted, path-free JSON summary suitable for reporting. No automated repair modifies any MCP host configuration.

## Codex tool approval

Plugin enablement, Hook trust and permission to call a tool are separate checks. A successful local service check or visible tool list does not establish that the current Codex session may call `screen_mark`. The default light plugin has no command Hooks; drawing a decorative mark does not need Accessibility permission.

If Codex reports `MCP tool call requires approval, but approval policy is never`, the host stopped the call before HandoffGlass received it. Repeating the drawing call, reinstalling the plugin or enabling Accessibility does not resolve that approval decision. Verify in a new interactive Codex chat that can show the tool approval request, and let the user decide when it appears. Keep the installation marked as unverified until an actual call succeeds.

Codex documents [plugin-scoped server and tool policy](https://developers.openai.com/plugins/build/plugins#configure-installed-server-policy). In the tested CLI `0.167.0-alpha.4.1`, temporary `screen_mark` approval settings parsed successfully with both the short plugin name and the marketplace-qualified name, but the model call still returned the error above. Runtime application of those settings remains unverified for that version. Tool authorization remains a host setting; the installer leaves it unchanged.

## Display map

Help → Details shows local display rectangles in a common **device-independent pixel (DIP)** coordinate space. Negative origins and each screen's scale factor are displayed. The desktop separately checks whether display metadata is internally consistent. This check is **not** a calibration against a physical pointer or window. This map is intended to troubleshoot geometry; it is not a live screenshot, an accessibility tree or proof that a marked control has been grounded.

The native UI locator must still revalidate the foreground application, exact match, visibility, obstruction and coordinate conversion immediately before a real annotation. On unsupported desktops use coordinate-free handoff rather than estimating the target position.

## Privacy & implementation

- Electron's sandboxed Control Center exposes only narrow, sender-bound IPC methods (`test`, `displays`, `report`). Callers never provide a process command or arbitrary file path.
- The self-test forces `HANDOFFGLASS_HEADLESS=1`, `HANDOFFGLASS_EXTRAS=0`, `HANDOFFGLASS_ENABLE_ACCESSIBILITY=0` and an isolated temporary runtime directory. Its child process and headless Broker are stopped after the check.
- The report is generated from a strict whitelist. It contains no window titles, session IDs, agent identity, tokens, instructions, file paths or screen content.
- The test checks transport behavior, not physical GUI rendering. Human input, click-through, multiple desktops/Spaces and secure-system windows still need real-device validation.

Entry points: `src/local/mcp-probe.mjs`, `src/local/display-layout.mjs`, `src/local/support-report.mjs`, `src/desktop/center.{mjs,js,html,css}`, `scripts/connection-check.mjs`. Validation: `test/mcp-probe.test.mjs` and the cross-platform CI `connection:check` step.
