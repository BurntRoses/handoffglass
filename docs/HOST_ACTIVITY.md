# Local MCP call evidence

The Control Center shows a short-lived trace **only when a local MCP process actually calls a tool**. A copied configuration, a running broker, and an isolated self-test are not presented as a verified agent connection.

## Prove a local call

1. Run the HandoffGlass desktop app, open **HandoffGlass → Connections**.
2. Generate a fresh MCP configuration for your host. The generated `env` includes `HANDOFFGLASS_HOST_ID`, a simple host label (`claude`, `codex`, `workbuddy`, `deepseek`, `trae`, etc.).
3. Install the configuration in the host and reload its MCP tools.
4. Ask the host to call **`screen_displays`**. No screen capture or sensitive data is needed.
5. Refresh Control Center. A recent request should appear with the declared host label and call count. The record expires after 15 minutes.

The bridge authenticates each tool request with a local bearer credential and an owner scope. It **does not authenticate the identity of the external host application**. The label comes from environment variables set by the generated configuration or by the DeepSeek native adapter. Any local process with the agent credential can make the same claim, so treat it as operational diagnostics, not security attestation.

## Retention and privacy

- Broker memory only; restart erases the trace. No database, disk log, telemetry or cloud sync.
- Each entry stores a fixed host label, last-seen timestamp, bounded call count and fixed endpoint code. It never stores prompts, arguments, UI labels, session IDs, user names, screen content or paths.
- At most 16 recent host labels and 15 minutes of observations. Unknown labels are displayed as **Unidentified**, not copied verbatim.
- A disconnected CLI session may remain visible until expiry; this is *recent activity*, not a live connection indicator.
- Isolated `connection:check` / desktop self-test uses its own runtime and cannot create a false host observation in the user's active broker.

The same on-device broker accepts many separate MCP clients. Their session ownership rules do not change: no client may read/cancel another client's handoff.

## Limits

Real end-to-end adoption of each third-party host requires launching that specific client and checking tool calls inside it. No such external host certification is implied by this feature. Cloud-only agents cannot reach your local broker without an intentionally designed bridge.
