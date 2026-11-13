# 宿主验收

所有宿主的真实模型任务闭环目前均为**未验证**。Codex 原生插件已完成隔离配置下的安装、工具发现、首次 MCP 调用和卸载；这项测试不调用模型，也不代替人类决策验收。

接入顺序为 Codex、Claude Code、DeepSeek Harness、WorkBuddy、Cursor、Trae、OpenCode。统一接口在 `src/hosts/adapter.mjs`：`observe`、`present`、`await_user`、`verify`、`resume`。观察和恢复能力由宿主注入；缺少接口时返回明确的交接动作，不切换到未授权的屏幕读取，也不假装唤醒模型。

| 宿主 | 自动检查范围 | 模型闭环 |
| --- | --- | --- |
| Codex | 原生插件安装、19 个工具、两个 Skill、首次调用、卸载 | 未验证 |
| Claude Code | 原生插件、MCP/Skill 快照及自有 marketplace 生命周期；未运行真实宿主 | 未验证 |
| DeepSeek Harness | Cordis 原生工具、共享契约、自有 patch/启动器及归属清理；本机未安装 Harness | 未验证 |
| WorkBuddy | 单 MCP + Skill 连接器结构 | 未验证 |
| Cursor / Trae | 独立运行包、MCP 配置合并/启停/恢复；未运行真实宿主 | 未验证 |
| OpenCode v2 | Plugin.define 原生入口、共享契约、按聊天隔离及 JSONC 合并/清理；未运行宿主 | 未验证 |

Codex CLI `0.167.0-alpha.4.1` 的真实模型试跑已发现 `screen_mark` 并尝试调用，但宿主返回 `MCP tool call requires approval, but approval policy is never`，调用未进入 HandoffGlass，未产生标记。临时工具级审批配置使用短插件名或 marketplace 完整名称均未改变结果。此记录只证明模型选择了工具，不证明绘制、人工决定、核验或恢复；对应处理见[工具审批诊断](CONNECTION_DIAGNOSTICS.md#codex-tool-approval)。

0.23 已为本地绘制补充非破坏、无外部访问的 MCP 标记，并把安装、启用、工具加载、绘制授权和首次调用拆成独立检查。是否解除上述宿主审批阻塞，需更新插件后由当前交互式会话实际调用确认；不修改宿主审批策略。

## 开始实机验收

依赖已安装的源码目录先运行：

```sh
npm run test:preacceptance
```

它执行源码、单元及隔离 MCP 检查，不安装宿主、不打开桌面、不调用模型。图形回归另用 `npm run test:release-ui` 和 `npm run test:plugin-runtime`；这两项会打开临时 Electron 窗口，使用隔离运行目录，不修改当前宿主连接。

选定一个已安装的本地宿主后，按[宿主连接](HARNESS_PLUGINS.md)安装并重载。验收时发给 Agent：

```text
用 HandoffGlass 指引我打开当前应用的设置。每次只提示一步，等我操作后检查原应用，再继续下一步。
```

每个宿主分别记录以下过程：

1. 显示安装版本，确认只保留一个 HandoffGlass 入口；完成宿主要求的信任、启用与重载。
2. 当前会话发现工具，实际绘制一个标记并清除；若出现工具审批，由用户决定。
3. 完成普通设置、多步文件导入、敏感确认拒绝/取消三类测试；记录人类决定、Agent 原应用观察与核验结果。
4. 测试挂起后返回、中断、目标失效、Broker 重启和双会话隔离；停止后不再出现新提示。
5. 在该宿主中停用、恢复、移除；核对其他 MCP/插件和用户编辑的文件仍保留，清理结果无遗漏。

Windows、物理多屏与混合 DPI 另按[桌面验收](DESKTOP_QA.md)在对应设备执行。macOS 单屏或合成事件不能补填这些状态；签名独立 App 不作为本地插件验收前提。

状态源为 [host-evidence.json](host-evidence.json)。每条完成记录须包含：版本与平台、真实任务、引导事件、人类决定、宿主独立核验、任务恢复和失败情况。不得包含账号 ID、凭证、截图、文件正文或同意历史；公开记录只记测试事实与脱敏摘要。

记录完成后先运行 `npm run host:evidence:check`。验证器要求四个阶段全部有事实摘要：`guidance`、`human_decision`、`independent_verification`、`resume`；核验必须由宿主独立完成并返回 `verified`，人类决定必须明确，且记录只能包含短摘要和风险等级。凭证、令牌、账号标识、截图、窗口标题、聊天记录、文件正文和同意历史字段会被拒绝。只有把记录路径写入对应 host 且验证器通过，`status: verified` 才能进入发布检查；当前七个 host 均保持 `unverified`。

单条记录使用以下最小结构，保存为仓库内的脱敏 JSON 后再引用：

```json
{
  "schemaVersion": 1,
  "host": "codex",
  "platform": "macos-arm64",
  "hostVersion": "宿主版本",
  "handoffglassVersion": "0.23.0",
  "task": {"kind": "settings", "summary": "短任务摘要", "risk": "low"},
  "stages": {
    "guidance": {"status": "verified", "evidence": "已显示目标并等待用户操作"},
    "human_decision": {"status": "verified", "decision": "completed", "evidence": "用户完成操作"},
    "independent_verification": {"status": "verified", "result": "verified", "evidence": "宿主重新观察原应用并确认结果"},
    "resume": {"status": "verified", "nextAction": "resumed", "evidence": "任务在核验后继续"}
  },
  "result": "completed",
  "limitations": []
}
```

云端 Jules、Codex Cloud 不进行本地屏幕适配。后台 Hooks 不能启动空闲模型轮次，用户需要回到原会话继续。

官方接口参考：[Codex 本地插件](https://developers.openai.com/plugins/deploy/desktop-only)、[Claude Code manifest](https://code.claude.com/docs/en/plugins-reference)、[DeepSeek defineTool](https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/tool)、[OpenCode 插件](https://opencode.ai/docs/build/plugins/)。OpenCode 当前文档已区分新版插件 API，旧版配置测试不能当作新版原生插件验收。
