# 宿主插件与连接

HandoffGlass 共用一套本地 Broker、绘制运行时和会话工具，按宿主提供不同入口。下列七种接入已具备安装、状态检查与清理服务；实际宿主加载、信任和任务闭环分别验收，见[宿主验收](HOST_EVIDENCE.md)。

| 宿主 | 接入形式 | 安装与启停 | 尚需宿主内确认 |
| --- | --- | --- | --- |
| Codex | 原生插件，MCP + Skills，可选 Hooks | 原生 marketplace / plugin 命令 | 新聊天加载、绘制审批、实际任务 |
| Claude Code | 原生插件，MCP + Skill，可选 Hooks | 自有 marketplace，user scope 原生命令 | 信任、重载、实际任务 |
| DeepSeek Harness | Cordis 原生工具插件 | 自有 patch 与启动器 | 已安装 Harness、插件加载与 Agent 事件 |
| WorkBuddy | 单 MCP + Skill 本地连接器 | 生成及清理本地包；宿主内启停 | 导入、信任、启用、绑定与实际调用 |
| Cursor | 本地 MCP + Skill 包 | 合并自有 MCP 项；移除/恢复该项启停 | 重载、工具授权与实际调用 |
| Trae | 本地 MCP + Skill 包 | 已选 MCP 配置或项目配置中的自有项 | 选择正确配置、启用、重载与实际调用 |
| OpenCode v2 | 原生 TypeScript 插件 | 合并 JSONC `plugins` 数组中的自有路径 | 对应 SDK 版本、重载与实际任务 |

插件携带源码快照、生产依赖和本平台 Electron；安装后不依赖开发目录，也不要求另装独立 App。仍需 Node.js 22+ 和本地交互式桌面。运行包按操作系统和架构生成，不能把 macOS 包当作 Windows 包分发。

## Codex

```sh
npm run plugin:codex:install
npm run codex:readiness
```

默认 light：MCP + Skills，不运行命令 Hooks。可选 `--lifecycle=enhanced`，由用户在 Codex 中审核 Hook。工具更新后开新聊天；`codex:readiness` 默认只读取安装信息，`-- --probe-host` 才启动独立的无模型探测会话。探测不证明当前聊天已经加载，也不代替实际绘制审批。详见[Codex 插件](CODEX_PLUGIN.md)。

## Claude Code、DeepSeek、OpenCode、Cursor、Trae

从仓库根目录运行。安装、清理默认只预览，`--apply` 执行：

```sh
npm run plugin:harness -- install claude-code
npm run plugin:harness -- install claude-code --apply
npm run plugin:harness -- status claude-code
npm run plugin:harness -- disable claude-code --apply
npm run plugin:harness -- enable claude-code --apply
npm run plugin:harness -- cleanup claude-code --apply
```

将 `claude-code` 换成 `deepseek`、`opencode`、`cursor` 或 `trae`。安装器不安装宿主本身、不修改信任或审批，不覆盖其他 MCP 和插件。返回 `reloadRequired`、`nextAction` 说明还需完成的宿主步骤。安装状态来自自有记录和配置比对；`hostState:not_observed` 不是“已连接”。

- **Claude Code**：要求已有 `claude` 命令，可用 `--claude-command=/absolute/path` 指定。默认 MCP + Skill；增强 Hooks 另加 `--lifecycle=enhanced`。不修改 Claude Desktop 配置。
- **DeepSeek Harness**：要求已有 Harness，默认启动命令为 `dsh web`。当前入口固定 Cordis `4.1.0`、DSH agent/tools/llm `0.2.2-rc.2`；使用官方消息构造和 `Agent.followup`，仅向绑定的附着 Agent 交付决策事件。安装后按返回的 `launchCommand` 和 `launchEnv` 使用自有启动器，加载绝对路径 Cordis patch；App 会显示可复制命令，不修改 Harness 安装。源码环境可用既有 `npm run harness:deepseek -- /absolute/path/to/deepseek-harness` 生成开发入口。
- **OpenCode v2**：当前包固定 `@opencode/plugin` peer 为 `2.2.7`，通过 `session.prompt` 的 `queue` 交付模式向原附着会话传递决策事件。安装器保留 JSONC 注释、其他字段及其他插件，向 `plugins` 数组加入本地包路径；旧版 v1 API 不适用。勿同时开启同名 MCP。
- **Cursor**：默认合并 `~/.cursor/mcp.json` 的自有项；配套 Skill 位于生成包中，初始化同时提供工作流，不宣称宿主已自动发现 Skill。
- **Trae**：不猜测全局配置位置。使用 `--config=/absolute/path/to/mcp.json` 指定宿主实际配置，或 `--workspace=/absolute/path/to/project` 写入项目 `.trae/mcp.json`。安装后在 Trae 中启用并重载。

只生成独立包时使用 `build <host>`；只删除该包用 `remove <host>`。这两个低层命令不管理宿主配置；日常接入优先使用上面的 `install` / `cleanup`。

## WorkBuddy

App「连接」页生成本地连接器；CLI 使用 `npm run connector:workbuddy`。包内只有一个 MCP Server，包含 Skill、图标和版本要求。用户在 WorkBuddy 内导入、信任并启用；本地文件生成成功不等于宿主已经导入或绑定。

## 停用与清理

总开关立即停止本地引导并保留设置。指定宿主的停用则使用该宿主的原生插件开关或移除自有配置引用；WorkBuddy 返回宿主内操作提示。自然语言、App 与 MCP/CLI 共用[生命周期服务](INTEGRATION_LIFECYCLE.md)。

清理按安装记录核对文件和配置，只移除未改动的自有内容；用户新增、编辑的文件会保留并列出。开发仓库不属于卸载范围。WorkBuddy 的宿主内导入记录、系统 Accessibility 授权仍由对应宿主和系统管理。

## 官方契约

- [Codex 本地插件](https://developers.openai.com/plugins/deploy/desktop-only)
- [Claude Code 插件](https://code.claude.com/docs/en/plugins-reference)
- [DeepSeek 工具执行](https://deepseek-harness.github.io/deepseek-harness/en/reference/cookbook/adding-a-tool)
- [OpenCode v2 Server API](https://opencode.ai/docs/build/plugins/server/)

接口结构检查与真实宿主验收分开记录；下一步执行[宿主验收步骤](HOST_EVIDENCE.md#开始实机验收)。
