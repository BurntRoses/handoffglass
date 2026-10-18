# Harness and platform matrix (v0.6)

This distinguishes **generated MCP configuration** from **host-tested** and **desktop GUI-tested**. Only CI and real screenshots/logs from each host count as runtime verification.

| Harness | Form | Integration format | Config generation | App-specific verification |
| --- | --- | --- | --- | --- |
| Claude Desktop / Claude Code | Desktop / CLI | `mcpServers` stdio | Yes | Pending real host |
| OpenAI Codex | CLI / IDE | TOML `mcp_servers` | Yes | Pending real host |
| Cursor | Desktop IDE | `mcpServers` | Yes | Pending real host |
| VS Code | Desktop IDE | `servers` with `type:stdio` | Yes | Pending real host |
| GitHub Copilot | CLI / IDE | MCP config | Yes | Pending real host |
| Gemini CLI | CLI | `mcpServers`, timeout | Yes | Pending real host |
| Zed | Desktop IDE | `context_servers` | Yes | Pending real host |
| Cline | Desktop IDE / CLI | `mcpServers` | Yes | Pending real host |
| Windsurf Cascade | Desktop IDE | `mcpServers` | Yes | Pending real host |
| OpenCode | Desktop / CLI | `mcp.handoffglass = {type:"local",command:[...]}` | Yes | Pending real host |

All configurations point to the **same stdio MCP** and on the same OS user account share one broker. Desktop applications may run sandboxed; remote/cloud Agent runtimes do not automatically see the local desktop. If using SSH/containers/WSL, require a deliberate local proxy design before claiming support. Do not bind the broker to `0.0.0.0` or expose it to network tunnels by default.

| OS | Click-through overlay | Native exact-name lookup | Packaging | Reality |
| --- | --- | --- | --- | --- |
| macOS | Electron implementation | AX helper (permission + compile) | Unsigned zip preview | GUI/AX QA pending |
| Windows | Electron implementation | PowerShell UIAutomation (per-monitor DIP mapping) | Unsigned portable preview | GUI/UIA QA pending |
| Linux X11 | Electron overlay code | No native locator | Not priority | Not yet GUI verified |
| Linux Wayland | Compositor-specific overlay limitations | Not supported | Not priority | No system-wide guarantee |

Use `node scripts/configure.mjs all` for previews; `node scripts/install-host.mjs HOST --apply` only when your host's JSON config is known and validated. **OpenCode and TOML Codex** should be merged manually rather than rewriting JSONC/TOML.

References: https://docs.opencode.ai/docs/mcp-servers/ , https://github.com/cline/cline/blob/main/docs/mcp/mcp-overview.mdx , https://www.electronjs.org/docs/latest/api/screen
