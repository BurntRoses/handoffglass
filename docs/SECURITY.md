# Security model and boundaries

## User consent is nondelegable

HandoffGlass never clicks, types credentials, extracts OTPs, bypasses CAPTCHA, approves permissions or confirms payment. The human always sees the original application's native UI and chooses to proceed or refuse. Annotation text is an Agent suggestion, **not** an authenticated claim from the OS.

## Implemented controls

- Broker binds only to `127.0.0.1`, using a randomized port and bearer tokens with constant-time comparison.
- **Separate bearer tokens** for Agent endpoints and desktop events. The desktop secret is passed through a child-process environment variable and is never written to the runtime manifest.
- The per-user runtime directory is restricted to mode 0700 on POSIX; manifest files are mode 0600. A symlink or insecure runtime directory is refused. Windows relies on its user-profile ACLs, which require review during native QA.
- Atomic startup locking reduces multi-process races; the manifest's live process is checked through a token-authenticated `/health` probe.
- Agent ownership is a random ID assigned per MCP host. Status, wait and cancellation are owner-scoped; another Agent cannot replace or resolve an active request. Replaying stale session IDs fails.
- Rejects unexpected Host or browser Origin, does not set CORS headers, requires JSON POSTs, caps payload sizes, and validates on-screen coordinates.
- Electron renderers have context isolation, sandboxing, no Node integration, denied permissions, disabled webview attach and blocked external navigation. All user-supplied strings use `textContent`/SVG attributes; no untrusted HTML injection.
- Completion is explicitly `completionSource=user_report` and `verified=false` so the Agent must independently verify the target application's final state.

## Residual risks

- **Same-user malicious processes are outside this security boundary.** Files private to the same OS account and process memory may be accessible to other code running with that account. This is not a substitute for OS account isolation or privilege separation.
- A malicious or mistaken Agent can draw deceptive arrows. Users should examine native warnings and permission scopes. Future builds need robust grounding and trust labeling, not automatic consent.
- The broker retains no data across shutdown but can stay running after Agent disconnection; an orphaned handoff expires only by its configured TTL or a human response. An abandoned client cannot be forcibly cancelled by a different client through the normal API.
- Electron desktop overlays may not appear over privileged Windows UAC security desktops, managed Wayland sessions or protected macOS UI surfaces.
- There is no screenshot, password, token, or user data collection by design, but tool arguments (including typed descriptions) pass through the connecting Agent host, whose own logging/privacy policy is independent of HandoffGlass.
- There is no code signing, automatic updater, binary sandbox isolation or production software supply-chain guarantee.

## Reporting

For security reports, use GitHub private vulnerability reporting at https://github.com/BurntRoses/handoffglass/security/advisories/new when enabled. Public Issues are not private. If private reporting is unavailable, ask the maintainer for a private reporting channel without posting exploit details. Do not include real bearer tokens, OTPs, account identifiers or sensitive screenshots.
