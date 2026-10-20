# Local connection & display diagnostics

HandoffGlass uses a real, isolated MCP check to answer one narrow question: **can the current local installation start the stdio server, negotiate MCP, expose its expected tools and perform a headless display query?**

Open **HandoffGlass → Help → Check**. An independent headless MCP process uses a temporary private runtime directory and is terminated after the check. It cannot see your current handoff, approve a dialog or access the native UI locator. The check uses only `initialize`, `tools/list` and `screen_displays`.

For a source checkout:

```sh
npm ci
npm run connection:check
npm run readiness -- --json
```

The check returns `hostVerified:false`, even on success. The Control Center also records actual authenticated MCP tool calls, labeled only by the launch configuration and kept in memory for fifteen minutes; see [Host activity](HOST_ACTIVITY.md). A working local MCP executable does not prove that Claude, Codex, DeepSeek Harness, WorkBuddy or another host has installed its configuration. In the host, refresh tool discovery and confirm `screen_displays` and `handoff_request` appear; then call `screen_displays` once. No sensitive action is needed.

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

## Display map

Help → Details shows local display rectangles in a common **device-independent pixel (DIP)** coordinate space. Negative origins and each screen's scale factor are displayed. The desktop separately checks whether display metadata is internally consistent. This check is **not** a calibration against a physical pointer or window. This map is intended to troubleshoot geometry; it is not a live screenshot, an accessibility tree or proof that a marked control has been grounded.

The native UI locator must still revalidate the foreground application, exact match, visibility, obstruction and coordinate conversion immediately before a real annotation. On unsupported desktops use coordinate-free handoff rather than estimating the target position.

## Privacy & implementation

- Electron's sandboxed Control Center exposes only narrow, sender-bound IPC methods (`test`, `displays`, `report`). Callers never provide a process command or arbitrary file path.
- The self-test forces `HANDOFFGLASS_HEADLESS=1`, `HANDOFFGLASS_EXTRAS=0`, `HANDOFFGLASS_ENABLE_ACCESSIBILITY=0` and an isolated temporary runtime directory. Its child process and headless Broker are stopped after the check.
- The report is generated from a strict whitelist. It contains no window titles, session IDs, agent identity, tokens, instructions, file paths or screen content.
- The test checks transport behavior, not physical GUI rendering. Human input, click-through, multiple desktops/Spaces and secure-system windows still need real-device validation.

Entry points: `src/local/mcp-probe.mjs`, `src/local/display-layout.mjs`, `src/local/support-report.mjs`, `src/desktop/center.{mjs,js,html,css}`, `scripts/connection-check.mjs`. Validation: `test/mcp-probe.test.mjs` and the cross-platform CI `connection:check` step.
