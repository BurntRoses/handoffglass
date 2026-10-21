# Agent 接入与验证范围

HandoffGlass 提供本地 stdio MCP 服务。下表表示已实现的配置生成方式；它不表示在每个宿主中都完成了任务验收。

| Host | 生成配置 / 接入方式 | 自动移除范围 |
|---|---|---|
| Codex CLI / IDE / App | `node scripts/configure.mjs codex`；安装器合并 `config.toml` 与 Skill | 有记录的配置与 Skill |
| Claude Desktop | `node scripts/configure.mjs claude`；`mcpServers` | 手动移除本工具条目 |
| Claude Code | 按宿主 MCP 命令注册 stdio 服务；不使用 Desktop 配置文件 | 通过宿主移除 |
| Cursor | `node scripts/configure.mjs cursor` | 手动移除本工具条目 |
| VS Code | `node scripts/configure.mjs vscode`；`servers` | 手动移除本工具条目 |
| Gemini CLI | `node scripts/configure.mjs gemini` | 手动移除本工具条目 |
| OpenCode | `node scripts/configure.mjs opencode` | 手动移除本工具条目 |
| Cline / Windsurf / Zed / Trae | `node scripts/configure.mjs <host>` | 手动移除本工具条目 |
| WorkBuddy | `npm run connector:workbuddy`；本机 MCP + Skill | 有记录的本地包；已导入连接器需在宿主移除 |
| DeepSeek Harness | `npm run harness:deepseek`；实验性 Cordis 插件 | 通过宿主移除 |

[Agent 安装](INSTALL_AGENT.md)用于安装；[Codex 接手](CODEX_HANDOFF.md)用于继续开发。

## 自动测试证明什么

| 检查 | 能证明的内容 | 不包含的内容 |
|---|---|---|
| `npm run verify` | 配置解析、状态机、权限策略和本地逻辑 | 外部宿主加载 |
| `npm run test:integration` / `test:extras` / `test:legacy` | 真实 MCP SDK 初始化、工具 Schema 与本地 Broker 行为 | 宿主信任、工具审批和模型选择 |
| `npm run connection:check` | 隔离服务可启动并列出所需工具；`hostVerified:false` | 当前宿主已连接 |
| `npm run test:packaged` | 构建包内的 MCP、原生资源和连接文件 | 原生桌面视觉验收 |
| 实机宿主任务 | 对应版本和系统上的加载、操作回传、核验与继续 | 未测试的系统和宿主版本 |

正式宿主、物理多屏和 Windows 实机验收仍在 [发布状态](COMMUNITY_RELEASE.md)中单独跟踪。更多配置细节见 [集成指南](INTEGRATIONS.md)。
