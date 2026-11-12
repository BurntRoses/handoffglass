# 本地宿主插件包

按 Codex、Claude Code、DeepSeek Harness、WorkBuddy、Cursor、Trae、OpenCode 的顺序推进。当前包均是本地工程预览；真实模型与人类闭环见[证据表](HOST_EVIDENCE.md)，构建成功不等于宿主验证通过。

## Codex

使用[原生插件安装器](CODEX_PLUGIN.md)。默认 Skills + MCP，不含命令 Hooks；运行快照和 Electron 随插件携带，Node.js 22+ 仍须保留。工具更新后开新聊天。可用自然语言停用、清理接入或卸载，所有入口按安装清单核对归属。

## Claude Code

```sh
npm run plugin:harness -- build claude-code
claude --plugin-dir ./dist/claude-code-local
```

`.claude-plugin/plugin.json`、`.mcp.json` 和 Skills 使用 Claude Code 官方插件结构，MCP 入口为 `${CLAUDE_PLUGIN_ROOT}/runtime/src/mcp.mjs`。不改 Claude Desktop 配置，不自动信任。关闭临时插件会话即可结束试用；永久安装按当前 Claude Code 的插件管理流程完成。

## DeepSeek Harness

不自动安装 Harness。已有源码环境时运行：

```sh
npm run harness:deepseek -- /absolute/path/to/deepseek-harness
```

在 Harness 根目录执行返回的 patch 命令。生成的 `scratch-handoffglass` 携带完整 runtime；插件内部相对导入，不再引用 HandoffGlass 开发目录。Cordis 注册使用共享 JSON Schema，返回结构化值，按 `exec.agent` 分离所有权，传播取消信号，随插件 effect 注销。上下文注入不等于唤醒空闲模型。

## WorkBuddy / Cursor / Trae

WorkBuddy 继续采用单 MCP + Skill 连接器。Cursor、Trae 使用宿主官方本地 MCP 配置与 Skill/规则入口。没有原生插件实现的宿主不标为原生插件支持。安装、信任、启用、加载和首次调用分别检查，参见[接入指南](INTEGRATIONS.md)。

## OpenCode v2

```sh
npm run plugin:harness -- build opencode
```

在目标 OpenCode 的配置中，把生成目录加入 `plugins`，例如 `{"plugins":[{"package":"/absolute/path/to/dist/opencode-local"}]}`。仅合并这一项，保留其他字段。此包使用新 `@opencode/plugin` 的 `Plugin.define`、工具 transform 与 context hook；旧 v1 API 不适用。按聊天分配 Broker owner，工具校验与 MCP 共用。不要同时启用同名 MCP，避免重复工具。

## 停用与删除

临时停用用 HandoffGlass 总开关。移除本地原生包先从宿主管理界面/配置去掉该包，再运行：

```sh
npm run plugin:harness -- remove opencode
npm run plugin:harness -- remove opencode --apply
```

将 `opencode` 换成对应宿主；自定义目录加 `--output=/absolute/path`。默认只预览。安装清单逐文件核对哈希，只移除未改动的自有内容，保留用户编辑与新增文件并报告。Codex 请使用专用原生卸载器，不手动删缓存。

## 官方契约

- [Claude Code 插件](https://code.claude.com/docs/en/plugins-reference)
- [DeepSeek 工具执行](https://deepseek-harness.github.io/deepseek-harness/en/reference/cookbook/adding-a-tool)
- [OpenCode v2 Server API](https://opencode.ai/docs/build/plugins/server/)

这些页面定义接入格式；真实模型闭环须在已安装的宿主内另行记录。
