# Control Center

The desktop Control Center is the long-lived management surface of HandoffGlass. It is separate from the three-step first-run Setup and the human-decision panel.

Open it from the tray menu (**Control Center…**). Double-clicking the tray icon opens the current decision panel when a human response is pending; otherwise it opens Control Center.

## Surfaces

| Page | What it does | How information is obtained |
| --- | --- | --- |
| Overview | Local broker, desktop heartbeat, current handoff, recent Agent API activity | Authenticated loopback read-only diagnostics |
| Agent connections | Host-specific MCP config preview and copy | Existing config generator; no automatic host modification |
| Appearance | Theme, locale, drawing style, motion, density and UI lookup consent | Private local preferences; explicit user save |
| Diagnostics | Broker, desktop, recent calls, display count and safe handoff summary | Sanitized snapshot; no window title or task content |

## Correct reading of connection status

A green broker indicator means the local broker is responding. “Recent Agent activity” means a valid owner-scoped call reached the broker within the preceding two minutes. This **does not prove** that a particular Claude, Codex, Trae, WorkBuddy or other MCP client has loaded the server. Ask the host to list MCP tools to verify that.

The interface never displays or exports broker bearer tokens, owner IDs, screen content, account names, window titles or task instructions. The diagnostics API is authenticated using the **desktop-only secret**, inaccessible using the Agent secret.

## Security and permissions

- Electron Control Center runs sandboxed with isolated renderer context, no Node integration and a restrictive CSP. Each IPC request is sender-bound to the Control Center window.
- Each preference is validated against a finite allowlist and written to a private local file. User preference always takes precedence over an Agent suggestion.
- Accessibility lookup remains opt-in. Saving the checkbox requests only a local consent setting; granting operating-system accessibility permission, where required, is separate.
- UI never instructs an agent to approve sensitive actions automatically.
- Host MCP config is only copied to clipboard after a deliberate click; application settings of other hosts are never changed implicitly.

## Local development

```sh
npm run verify
npm run desktop:demo
```

For a real desktop integration review, inspect `src/desktop/center.{html,css,js,mjs}`, `src/desktop/center-preload.cjs`, and `src/desktop/center-model.mjs`. The desktop status endpoint is `GET /desktop/diagnostics` in `src/bridge.mjs`.

See `docs/DESKTOP_QA.md` for real-device window, DPI, permissions and accessibility validation. A browser preview with mocked desktop state is useful for layout checks, **not** a physical desktop acceptance test.

When settings are being edited, periodic refresh does not overwrite the form. Once saved, the next refresh reflects any changes made from the tray or another settings window.
