# Harness compatibility matrix (2026-10-18)

**One server, multiple adapters.** The HandoffGlass MCP server remains stdio; each host starts the same Node.js entry path. This matrix documents config shapes, not a claim of physical compatibility with every release of each host.

| Host | Generator | Placement / shape | Basis |
| --- | --- | --- | --- |
| Claude Desktop | `node scripts/configure.mjs claude` | existing Claude desktop `mcpServers` JSON | Claude documentation |
| Claude Code | `node scripts/configure.mjs claude` | `claude mcp add` or `.mcp.json`, `mcpServers` | Claude Code MCP documentation |
| OpenAI Codex CLI / IDE | `node scripts/configure.mjs codex` | `~/.codex/config.toml`, `[mcp_servers.handoffglass]` | OpenAI Codex configuration |
| Cursor | `node scripts/configure.mjs cursor` | `~/.cursor/mcp.json` or `.cursor/mcp.json`, `mcpServers` | Cursor official MCP docs |
| VS Code | `node scripts/configure.mjs vscode` | `.vscode/mcp.json`, `servers` + `type: stdio` | VS Code MCP config reference |
| GitHub Copilot CLI / Agent harness | `node scripts/configure.mjs copilot` | portable `.mcp.json`, `mcpServers` | VS Code portable Copilot reference |
| Gemini CLI | `node scripts/configure.mjs gemini` | `~/.gemini/settings.json`, `mcpServers` | Gemini CLI official docs |
| Zed | `node scripts/configure.mjs zed` | settings.json, `context_servers` | Zed official docs |

Official documentation:
- https://code.visualstudio.com/docs/agents/reference/mcp-configuration
- https://code.visualstudio.com/docs/agent-customization/mcp-servers
- https://prod.cursor.com/docs/mcp
- https://geminicli.com/docs/tools/mcp-server/
- https://zed.dev/docs/ai/mcp
- https://developers.openai.com/zh-Hans/docs/config-file/config-basic
- https://code.claude.com/docs/en/mcp

## Installation profiles

### MCP-only (CI / agent sandbox)

```bash
npm ci --omit=optional
npm run verify
npm run test:integration
```

**MCP-only does not show a local overlay.** A remote/sandboxed Agent cannot make the local user's screen display annotations by configuration alone. In a headless environment you may set `HANDOFFGLASS_HEADLESS=1` for protocol tests, but do not imply the user saw a message.

### Local desktop

```bash
npm ci
npm run doctor
npm run desktop:demo
```

Electron is optional in the package metadata to keep headless installation small. You must have a graphical session on the same machine. Some protected OS dialogs cannot be overlaid.

## Compatibility test levels

1. **Config-generated:** local JSON/TOML shapes were unit-tested.
2. **Protocol-tested:** MCP SDK v2 dual-client stdio handshake in GitHub Actions (Windows/macOS/Linux).
3. **Host-tested:** start from a specific Claude/Codex/Cursor/etc binary and verify MCP discovery, approval settings and call latency (not yet complete).
4. **GUI-tested:** real local desktop verifies click-through, focus, monitors and handoff decision (not yet complete).

Do not conflate these levels. Approval and tool permission behavior is owned by each host and should not be bypassed. Gemini `trust:false` is the safer default; HandoffGlass does not insert blanket trust settings.

## Opt-in installation (JSON configurations only)

`node scripts/install-host.mjs cursor` is dry-run by default. Add `--apply` for an explicit JSON merge with a timestamped 0600 backup; add `--replace` only if deliberately updating an existing HandoffGlass entry. It supports Cursor, Gemini, Copilot, Zed, VS Code workspace and Claude Desktop on macOS/Windows. It **refuses to rewrite JSONC/comments or malformed JSON**, since stripping comments or damaging host settings is worse than a manual copy-paste. For Codex's TOML configuration, use `node scripts/configure.mjs codex`.

Do not run an automatic host installer on a machine other than the user's own authorized local environment. Generated host configs contain **no API keys or access tokens**.
