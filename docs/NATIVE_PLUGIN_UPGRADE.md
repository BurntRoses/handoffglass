# HandoffGlass 原生插件升级计划

日期：2026-11-11。目标：在保留单一桌面 Broker 的基础上，把各宿主的工具循环、执行阶段和用户操作接起来。Codex 为第一条试用路径；本次不安装 DeepSeek Harness、Claude Code 或 OpenCode。

当前交付：[Codex 本机插件试用](CODEX_PLUGIN.md)。P0 的打包、原生工具发现、首调与移除已验证；用户审核后的完整桌面闭环保留为试用验收。P1–P5 为后续工作。

## 先解决什么

当前图形可以跟随目标，但步骤推进仍依赖模型显式等待与再次提交。现有 DeepSeek Cordis 适配只是三个工具，缺少 Agent 事件接入。升级以真实任务接续为验收对象，不以形状数量或动效数量作为连续体验的证明。

## 共用层与宿主层

- 共用层：Broker、原生观察、场景渲染、会话/步骤、游标日志、启停、恢复和安装归属记录。
- 宿主适配：绑定宿主会话与 HandoffGlass 会话、同步真实执行阶段、传递用户操作事件、处理停止和卸载。
- 绑定必须由当前会话返回的能力凭证证明，不能按“当前活动窗口”或“最近一次请求”猜测归属；不读取聊天日志、提示词或工具参数做隐式绑定。
- 本地常驻的是事件与 UI；不持续调用模型。已知的几何、动画和重定位由本地完成，需要语义判断才交回原 Agent。
- 用户报告、目标消失和可见性变化都不是最终成功。敏感决定仍由用户完成，任务结果独立核实。

## 阶段与交付

| 阶段 | 交付 | 验收 |
| --- | --- | --- |
| P0 · Codex 试用 | 可安装的本地插件：MCP、Skill、SessionStart、工具/模型阶段、Stop 接续保护、Interrupt/SessionEnd 清理；安装/移除命令 | Codex 原生插件加载器发现并安装；MCP 初始化和首调；Hook 信任明确；双会话隔离；接续保护有界；停止不重启 |
| P1 · 步骤运行时 | 可更新步骤图、目标条件、候选下一步、超时与恢复分支；本地立即反馈 | 窗口变化与用户报告立即反馈，已知下一目标开始定位；意外分支回到 Agent；无假完成 |
| P2 · DeepSeek Harness | 将旧三工具适配升级为 Agent 范围的 Cordis 服务，订阅生命周期；用公开 Agent API 传递接续/上下文；插件卸载撤销资源 | 固定 DSH 版本实测同一任务持续推进；`inject` 不误当唤醒；跨 Agent 不串会话；卸载后不遗留监听 |
| P3 · Claude Code | `.claude-plugin`、MCP、Skill、Hooks；如需异步消息，单独评估 Channels 的可用版本和授权 | 使用真实 Claude Code 加载、信任、工具和停止回调；不把 Claude Desktop 当 Claude Code |
| P4 · OpenCode | 按实际版本的本地插件目录/API 提供生命周期适配，共用 Broker；MCP 保留为降级路径 | 服务端事件和会话接续实测；UI 开关与整体插件停用分开；热重载不重复订阅 |
| P5 · 发布与长任务 | 打包可分发运行时、版本兼容矩阵、安装迁移、性能基准 | macOS/Windows、物理多屏、三个以上真实任务；签名和宿主实测各自记录 |

## Codex 首版范围

使用正式本地 marketplace 与原生 plugin add/remove，不手改缓存或信任数据库。插件加载阶段提供精简工作流；MCP 仍是动作通道。工具返回结果把宿主会话绑定到自己的 HandoffGlass 会话；Hooks 仅接收阶段、步骤和最少状态，不保存提示词、目标标签、工具原始参数或截图。

Stop 只在当前绑定的有效引导确实未结束时提供一次接续提示；没有事件时不无限阻止结束。后台 Hook 不能开启新的模型轮次。用户中断时暂停自己的引导；会话结束时取消自己的引导；不会影响其他宿主。

首版生成的插件引用本机已有 HandoffGlass 源码与 Node，标为本机试用包；移动/删除源码后需重新生成。它不是已经发布的自包含商店插件。后续正式包改为使用已安装桌面运行时或包含经验证的启动器。

本地插件启用与 Hook 信任分开。首次安装完成后，需要在新的 Codex 会话中加载；Hooks 需在宿主界面审核。不会静默信任脚本或授予 Accessibility 权限。

## 各宿主如何接入

| 宿主 | 分发和入口 | 接续方式 | 本轮状态 |
| --- | --- | --- | --- |
| Codex | 本地 marketplace、`.codex-plugin`、MCP、Skill、Hooks | 活跃轮次内工具事件与有界 Stop 提醒；空闲轮次自动唤醒不作支持承诺 | 已实现本机试用；原生加载与首调通过；待用户审核和任务试用 |
| DeepSeek Harness | Cordis 插件，固定实际 Harness 版本 | `ctx.agents` 的 Agent 范围订阅；需要继续执行时使用 `followup`/`steer`，只补充信息时使用 `inject` | 已有三工具适配；原生生命周期适配待做；本机未安装 |
| Claude Code | `.claude-plugin`、独立插件 marketplace、MCP、Skill、Hooks | 先完成活跃轮次内接续；Channels 另行按宿主可用性验证 | 待实现；不改动现有 Claude Desktop 连接 |
| OpenCode | 本地 TypeScript 插件和版本固定的 SDK；MCP 作动作通道 | 按对应版本订阅会话/工具事件，通过公开会话接口接续；插件卸载撤销订阅 | 已有 MCP 配置模板；原生插件待实现 |

插件能做什么由宿主公开 API 决定。不能把同一个 MCP 配置复制到四个宿主后称为完成原生适配。现有对话无法被后台 Hook 唤醒时，界面应显示“回到原会话继续”；需要自有常驻 Agent 时，另建可控客户端，不隐式接管用户其他聊天。

## 下一轮实现清单

1. 在 `src/local/` 增加步骤运行时：保存当前步骤、目标证据、允许的用户动作、核验条件、下一步候选与失效分支。模型一次提交有边界的步骤信息，窗口移动、目标跟随和简单已知分支由本地处理。
2. 场景与任务分开更新。保留现有 `session_update` 的局部绘制；步骤切换携带 `expectedStep` 和场景版本。过期的点击、Hook 和定位结果不能覆盖新步骤。
3. 规定宿主适配器契约：绑定、上报阶段、订阅游标、交付事件、取消、释放。每条消息携带宿主会话证明、HandoffGlass 会话、步骤/epoch 和事件游标；不得按全局最新会话路由。
4. 本地先反馈用户动作，再按需调用 Agent。确定目标可以预定位；核验尚未完成时不得显示成功、继续敏感步骤或自动点击。未知分支把事件摘要交回原 Agent，不重复提交整份技能和场景树。
5. 先在 Codex 完成“设置页→用户操作→原应用核验→下一步”的真实任务；再把共用适配器接入 DSH，之后 Claude Code 与 OpenCode。每个宿主分别记录版本、加载、信任、首调、停止、重连和卸载结果。

建议的步骤结构与本轮已发布 MCP 参数分开设计，避免提前要求 Agent 调用不存在的能力：

```json
{
  "stepId": "open-settings",
  "target": {"source": "native", "query": "observed control reference"},
  "presentation": {"mark": "ring", "text": "打开设置"},
  "await": {"event": "user_report_or_observed_change"},
  "verification": {"kind": "independent_app_observation"},
  "branches": {"verified": "choose-page", "target_lost": "reacquire", "unknown": "agent"}
}
```

这份结构是 P1 草案；本轮插件仍使用已有连续会话工具。运行时方案完成后再确定工具和 schema，不在首版加入空壳工具。

## 体验与性能验收

固定任务：打开设置并切换页面、导入普通测试文件、敏感确认的拒绝/取消。分别测量用户动作→本地反馈、事件→宿主接收、宿主接收→下一步呈现；模型时间与本地时间分开。记录失效目标、重复调用和需要用户重述的次数。

本地目标：动作反馈 ≤100 ms；移动与布局计算不唤醒模型；用户操作按已绑定会话传递；停止后无新提示；断线后只凭恢复令牌与新观察恢复。目标值必须实测，不能由单元测试或打包结果代替。

## 官方依据

- [Codex 插件与本地 marketplace](https://developers.openai.com/plugins/build/plugins)：Hooks 插件当前走手动安装路径，不把它当作已符合公共商店发布要求。
- [Codex Hooks](https://learn.chatgpt.com/docs/hooks)：信任、执行阶段、Stop 与异步输出限制。
- [Codex App Server](https://learn.chatgpt.com/docs/app-server)：需要自己掌握线程/轮次控制时的独立客户端路线，不等于接管任意现有 App 会话。
- [DSH Agent API](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/core/agent/README.md)：followup/steer/inject 的区别与 Agent 作用域。
- [Claude Code 插件](https://code.claude.com/docs/en/plugins-reference)：目录、MCP、Hooks 和 Channels。
- [OpenCode 插件](https://opencode.ai/docs/plugins/)：本地目录、启停与重载；接入前固定实际 API 版本。
