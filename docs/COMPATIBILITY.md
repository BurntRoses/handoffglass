# Agent 接入

HandoffGlass 使用统一的本地 stdio MCP 服务，不同 Harness 通过各自的配置接入。

| Host | 生成配置 | 入口 |
|---|---|---|
| Codex CLI / IDE | `node scripts/configure.mjs codex` | `~/.codex/config.toml` |
| Claude Desktop / Code | `node scripts/configure.mjs claude` | `mcpServers` |
| Cursor | `node scripts/configure.mjs cursor` | `.cursor/mcp.json` |
| VS Code | `node scripts/configure.mjs vscode` | `.vscode/mcp.json` |
| Gemini CLI | `node scripts/configure.mjs gemini` | `~/.gemini/settings.json` |
| OpenCode | `node scripts/configure.mjs opencode` | `mcp.local.command` |
| Cline | `node scripts/configure.mjs cline` | 本地 stdio MCP |
| Windsurf | `node scripts/configure.mjs windsurf` | 本地 stdio MCP |
| Zed | `node scripts/configure.mjs zed` | `context_servers` |
| Trae | `node scripts/configure.mjs trae` | 本地 stdio MCP |
| WorkBuddy | `npm run connector:workbuddy` | MCP + Skill |
| DeepSeek Harness | `npm run harness:deepseek` | Cordis 插件 / MCP |

## Codex 从 GitHub 接手

直接将 [Codex 接手指南](CODEX_HANDOFF.md) 交给 Codex。它会自行克隆或更新仓库、安装依赖、生成 MCP 配置并完成真实调用测试。

## 本地验证

```bash
npm run verify
npm run test:integration
npm run connection:check
npm run host:matrix
```

集成验证依次覆盖：**生成配置 → MCP 初始化 → 宿主实际调用 → 桌面交接 → Agent 核验与继续任务**。

[宿主集成细节](INTEGRATIONS.md) · [国产 Harness 插件](CHINA_HARNESS_INTEGRATION.md) · [桌面验收](DESKTOP_QA.md)。
