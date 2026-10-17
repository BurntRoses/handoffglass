# Security boundaries and practical threat model

## Design goals

1. Never auto-click, type credentials, intercept a CAPTCHA, override a permission dialog, or execute privileged actions.
2. Screen annotations should **not** be misrepresented as verified instructions from the operating system.
3. Protect the loopback control endpoint from ordinary third-party web pages and unauthorized remote access.
4. Avoid collecting or transmitting screenshots, passwords, 2FA codes or unnecessary personal information.
5. Preserve a refusal path for each human handoff.

## Current controls

- Binds only `127.0.0.1` on an ephemeral port. Not exposed to the LAN by default.
- Uses a cryptographically random 32-byte bearer token, compared with a timing-safe primitive.
- Denies requests with an unexpected Host header or browser Origin and does not enable CORS. Requires JSON Content-Type and limits request sizes.
- Electron renderer is sandboxed, context-isolated, with Node integration disabled, navigation and popup blocked, and permission requests denied. Only two narrow preload methods are exposed.
- Labels and messages are rendered using `textContent` and constrained SVG primitives, never injected as HTML.
- Decision IPC accepts only specific states **and requires the current session ID**, which prevents stale panel events from resolving a newer session.
- Bridge uses versioned state snapshots, not a backlog of actions that could replay after reconnection.
- Session completion is user-reported, never silently treated as target application verification.

## Residual risks / limitations

- Malware or another same-user process with access to this process's environment or process memory can potentially impersonate the local desktop. This is **not** a security boundary against local compromise.
- An Agent may provide a plausible but wrong or misleading target location, or write deceptive guidance. Users should read the original application dialog and judge for themselves. Future releases should bind annotations to accessible element identities and revalidate them.
- Global overlay windows cannot be guaranteed on Windows secure desktop/UAC, macOS protected surfaces or some managed Wayland sessions.
- Multi-process coordination is not implemented; simultaneous MCP clients may each launch overlays and conflict.
- Sensitive user-entered values in the **original application** are not read by this system; do not put them into tool parameters.
- No release signing, auto-update supply chain or packaged desktop distribution is provided in this prototype.

## Reporting

For a private repository, open a private issue or send the owner a private report. Do not publish exploitable sensitive details or tokens.
