# HandoffGlass

**Give an AI agent a way to point — and a safe way to hand control to a human.**

> **0.4.0 engineering preview · local-first · Node.js + Electron · MCP v2 + Agent Skill**  
> Supports Windows/macOS design targets. GUI behavior must be validated on an actual graphical desktop. This is not a general screen-understanding, CAPTCHA-solving or auto-clicking system.

HandoffGlass is a developer-focused interaction layer that extends **existing** computer-use agents. The agent can show visual annotations on the user's desktop, request a manual decision, receive an explicit outcome and resume its original workflow **after separately verifying the real result**.

It is not a chat app, hosted SaaS, remote-control system, screenshot recorder or browser extension. No cloud account or server is required.

## The gap it fills

- The agent is blocked by MFA, a permission dialog, a secure prompt, or a sensitive action the human must perform.
- A small human action is less costly than multiple unreliable model attempts.
- The user doesn't know which UI control to locate; the agent can highlight a **previously observed** target.
- The calling agent needs clear machine-readable states instead of interpreting an ambiguous “done” chat message.

Prior art: [big-arrow-on-the-screen](https://github.com/franzenzenhofer/big-arrow-on-the-screen), [Handrail](https://github.com/M19K/handrail), and browser Human-in-the-Loop tools. HandoffGlass differentiates by exposing the *handoff lifecycle as reusable tool primitives*, not by claiming to have invented screen arrows.

## Install / 安装

Requirements: **Node.js 22+**, a local Windows or macOS interactive desktop, and an MCP-capable host. Clone or extract this repository:

```bash
npm ci
npm run verify
npm run doctor
npm run configure        # generate your machine-specific MCP settings
npm run test:integration
npm run broker:status    # check the shared background broker
npm run broker:stop      # stop the shared background broker
# Optional, on a real Windows/macOS desktop:
npm run desktop:demo
```

**In your MCP client**, point at the `src/mcp.mjs` entry using an **absolute path** (Node executes the server; Electron is launched automatically by the shared Broker when the first UI tool is called):

```json
{
  "mcpServers": {
    "handoffglass": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/HandoffGlass/src/mcp.mjs"]
    }
  }
}
```

See [integration quick start](docs/INTEGRATIONS.md). Client config examples: [`examples/mcp.json`](examples/mcp.json), [`examples/codex.toml`](examples/codex.toml). Copy [`skills/visual-handoff/SKILL.md`](skills/visual-handoff/SKILL.md) into a host-specific Skills folder if supported. The Skill supplies usage instructions; **the MCP connection is what enables tools**.

Example on Windows: `C:\\Users\\yourname\\Projects\\HandoffGlass\\src\\mcp.mjs`; on macOS: `/Users/yourname/Projects/HandoffGlass/src/mcp.mjs`.

### Demo, no dependencies

```bash
npm run demo
```

Open <http://127.0.0.1:4173>. This HTML playground **simulates** the workflow in a browser. It is not the OS-level Electron overlay and does not exercise the MCP SDK.

## Tools

| Tool | Responsibility | Typical response |
|---|---|---|
| `screen_displays` | Return display IDs and global logical DIP bounds, not screenshots | `{displays, connected}` |
| `visual_show` | Draw 1–8 confirmed target annotations | `{session, visible}` |
| `handoff_request` | Ask the human to act, **with or without coordinates** | `{session, visible}` |
| `handoff_status` | Read a session | `{session, connected}` |
| `handoff_wait` | Wait for a decision up to 30 seconds | `{session, pending?}` |
| `handoff_cancel` | Cancel a known session by ID | `{session}` |

### Example A: handoff when target location is unknown

```json
{
  "title": "请核对授权窗口",
  "message": "请在原始窗口阅读请求权限与账户信息，自行决定是否继续。结束后选择‘我已完成’或‘拒绝’。",
  "timeoutSeconds": 300
}
```

The desktop will show only the action panel. **It will not invent an x/y coordinate.**

### Example B: guide multiple verified targets

```json
{
  "title": "应用设置",
  "message": "先核对权限，再查看撤销选项。",
  "annotations": [
    {"x": 315,"y": 205,"shape":"ring","label":"权限说明"},
    {"x": 820,"y": 545,"shape":"box","label":"取消","width":128,"height":54}
  ]
}
```

Use with `visual_show` for guidance or with `handoff_request` if a human decision is required. Annotation shapes: `arrow`, `ring`, `box`, `spotlight` (up to 8). **Coordinates are desktop global DIP; they are NOT screenshot pixel coordinates.** Read `screen_displays`; obtain target locations from an *independent grounded source* such as accessibility APIs, the browser DOM or a calibrated Computer Use observation. HandoffGlass itself does not perform grounding.

### Result contract

`session.status`: `awaiting_user | completed | declined | cancelled | expired | superseded`.

When `completed`, `completionSource = "user_report"` and `verified = false` intentionally. The agent must verify the actual changed permission, file, account, etc. with its **own** tools. `handoff_wait` may return `pending: true` and the same `awaiting_user` session. A new request from **the same Agent** supersedes its previous request. A request from another Agent receives `busy` until the current session ends; agents cannot read or cancel sessions owned by other clients.

Sessions are kept in the single local Broker (not written to disk), so they **survive an individual MCP process exit**, but are lost when the Broker restarts. Multiple MCP hosts connect to the same Broker; each host receives a distinct ownership ID. The Broker stays running after a host exits; use `npm run broker:stop` to shut it down. An unresponsive or abandoned handoff remains active until its timeout, unless the owner or user cancels it.

## Architecture

```text
MCP host A ─┐
MCP host B ─┼─ stdio MCP v2 adapters (each with its own owner ID)
MCP host C ─┘                      │
                    private per-user runtime manifest (0600 on POSIX)
                                  │ agent-only bearer token
                                  ▼
                  SINGLE background Broker (127.0.0.1)
                       │               │
                 Owned sessions     Desktop-only bearer token
                      (TTL)             │
                            Electron desktop main
                             │             │
                       per-display     consent/guide panel
                       overlays        (human decisions)
```

`src/runtime.mjs` atomically coordinates first startup so simultaneous MCP clients launch one Broker. The runtime directory is private on POSIX (`~/.handoffglass`, mode 0700). `HANDOFFGLASS_RUNTIME_DIR` can override this for isolated integration tests; supply an absolute path. The Broker owns Electron, and separate bearer tokens distinguish Agent API calls from desktop UI calls. Loopback is **not** a boundary against malicious software running as the same user.

Key invariants: no screenshot or password capture; UI agent annotations do not click, type or approve; localhost bridge requires a random secret; Electron renderer is sandboxed; rendering uses text nodes, not user-provided HTML; stale / replayed events are eliminated via revisioned snapshots; display data is in DIP and local display geometry is used for overlays.

[Architecture details](docs/ARCHITECTURE.md) · [Security and trust boundaries](docs/SECURITY.md) · [Product strategy](docs/PRODUCT.md) · [Roadmap](docs/ROADMAP.md) · [Agent Skill](skills/visual-handoff/SKILL.md)

## Testing

- `npm run verify` runs JavaScript syntax and 22 Node tests for lifecycle, bridge, security, multi-monitor geometry and concurrency. Does **not** need installed dependencies.
- `npm run desktop:demo` opens a real overlay without requiring an Agent host; requires a graphical OS and Electron.
- `npm run test:integration` runs the **real official MCP SDK** client in headless mode and checks initialization, discovery, request, status, cancel and wait. Requires `npm ci`; does not show OS overlay.
- CI is configured for Node 22 on Windows, macOS and Linux. Only native macOS/Windows interactive desktop testing can validate click-through, fullscreen, secure dialogs and DPI.
- Do not assume a headless passing test means an operating-system permission dialog can be annotated. Windows UAC secure desktop and other protected desktops are out of scope.

**If running without Electron:** `HANDOFFGLASS_HEADLESS=1` enables tool/protocol smoke tests with `visible: false`. Do not mistake this for an on-screen presentation.

## Private GitHub repository

Source repository: **[BurntRoses/handoffglass](https://github.com/BurntRoses/handoffglass)** (private). The code is provided as an engineering preview: installing dependencies and passing CI are not equivalent to a signed, field-tested desktop application.

For contributors, work on a feature branch and submit PRs. Do not add credentials, `.env`, screenshots of private accounts, authentication cookies or other sensitive user data to commits.

## License & attribution

**UNLICENSED** for the private prototype. No source code was copied from the cited prior-art repositories. Review copyright notices and select a project license before any public open-source release.

## Lightweight v0.4 and host compatibility

Install only the MCP service in an automated CI/headless environment with `npm ci --omit=optional` (no Electron download). Install normal desktop support using `npm ci` in an interactive GUI session. The broker is lazily spawned on first use, not launched on every MCP process.

Generate merge-ready configs for Claude Desktop/Code, Codex, Cursor, VS Code, GitHub Copilot, Gemini CLI or Zed:

```bash
node scripts/configure.mjs all
node scripts/configure.mjs cursor --compact
node scripts/configure.mjs vscode gemini --compact
```

`--compact` reduces response size for smaller models; it **does not** change who may approve operations. Use stable `requestId` on retried `handoff_request` calls to avoid accidentally presenting the same sensitive prompt twice. Tool calls from remotely hosted/cloud Agent instances cannot reach a local desktop without an explicitly deployed companion and secure channel; such a remote bridge is not implemented.

Read [`docs/COMPATIBILITY.md`](docs/COMPATIBILITY.md), [`docs/MODEL_PLAYBOOK.md`](docs/MODEL_PLAYBOOK.md) and [`docs/AGENT_HANDOFF.md`](docs/AGENT_HANDOFF.md) before integrating a new harness.
