# 宿主验收

所有宿主的真实模型任务闭环目前均为**未验证**。Codex 原生插件已完成隔离配置下的安装、工具发现、首次 MCP 调用和卸载；这项测试不调用模型，也不代替人类决策验收。

接入顺序为 Codex、Claude Code、DeepSeek Harness、WorkBuddy、Cursor、Trae、OpenCode。统一接口在 `src/hosts/adapter.mjs`：`observe`、`present`、`await_user`、`verify`、`resume`。观察和恢复能力由宿主注入；缺少接口时返回明确的交接动作，不切换到未授权的屏幕读取，也不假装唤醒模型。

| 宿主 | 当前证据 | 模型闭环 |
| --- | --- | --- |
| Codex | 原生插件安装、18 个工具、两个 Skill、首次调用、卸载 | 未验证 |
| Claude Code | 原生插件目录与 MCP/Skill 快照构建、按清单删除；未运行宿主 | 未验证 |
| DeepSeek Harness | Cordis 原生工具入口、共享 18 工具契约、相对运行时；本机未安装 Harness | 未验证 |
| WorkBuddy | 单 MCP + Skill 连接器结构 | 未验证 |
| Cursor / Trae | MCP 配置结构 | 未验证 |
| OpenCode v2 | Plugin.define 原生入口、共享契约、按聊天隔离；未运行宿主 | 未验证 |

状态源为 [host-evidence.json](host-evidence.json)。每条完成记录须包含：版本与平台、真实任务、引导事件、人类决定、宿主独立核验、任务恢复和失败情况。不得包含账号 ID、凭证、截图、文件正文或同意历史；公开记录只记测试事实与脱敏摘要。

云端 Jules、Codex Cloud 不进行本地屏幕适配。后台 Hooks 不能启动空闲模型轮次，用户需要回到原会话继续。

官方接口参考：[Codex 本地插件](https://developers.openai.com/plugins/deploy/desktop-only)、[Claude Code manifest](https://code.claude.com/docs/en/plugins-reference)、[DeepSeek defineTool](https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/tool)、[OpenCode 插件](https://opencode.ai/docs/build/plugins/)。OpenCode 当前文档已区分新版插件 API，旧版配置测试不能当作新版原生插件验收。
