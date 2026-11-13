# HandoffGlass 原生插件升级

更新：2026-11-13。本轮以插件交付为主：共用一个本地 Broker 和按需绘制进程，按宿主接入工具、能力目录及事件。签名独立 App、商店发布和自动更新另行规划。安装入口见[宿主插件与连接](HARNESS_PLUGINS.md)。

## 已形成的交付

| 范围 | 实现 | 验收边界 |
| --- | --- | --- |
| 运行包 | MCP、Skill、场景资源、生产依赖和本平台 Electron 快照；按归属清理 | Node.js 22+ 仍须保留；跨平台包分别构建 |
| 连续会话 | Broker 持有会话，游标事件、恢复证明、独立核验、附着/挂起 | 挂起不唤醒空闲模型；用户报告不直接完成任务 |
| 能力预热 | MCP 初始化指令、共享工具契约、精简 host 目录与原生适配器上下文 | 模型速度和工具审批由宿主决定 |
| 连接管理 | 七宿主统一安装、状态、启停和清理入口；App、MCP、CLI 共用 | 已写入、已启用、已加载、已调用分开显示 |
| Codex | 原生 marketplace / plugin，MCP + Skills，light / enhanced 两种模式 | 隔离配置中的协议检查不能代替当前聊天审批 |
| Claude Code | 独立 marketplace，user scope 插件命令，可选生命周期 Hooks | 不混用 Claude Desktop；宿主加载和真实任务待验 |
| DeepSeek Harness | Cordis 工具、Agent 范围隔离、自有 patch / 启动器 | 不安装 Harness 本身；实际加载、事件与接续待验 |
| OpenCode v2 | 原生插件、共享工具契约、按聊天隔离，JSONC 配置合并 | 固定对应 SDK；宿主加载和真实任务待验 |
| WorkBuddy / Cursor / Trae | 单 MCP + Skill 连接器或本地 MCP 包，归属记录与清理 | WorkBuddy 导入/信任/绑定在宿主内完成；Trae 配置须明确 |

代码与协议检查结果见[实施记录](MUSE_IMPLEMENTATION.md)及现有 QA 记录。所有宿主的“引导→人类决策→独立核验→恢复”仍按[宿主证据](HOST_EVIDENCE.md)分别验收，不以打包成功替代。

## 共用层与宿主层

- 共用层处理会话、场景、目标跟随、几何、游标历史、恢复、权限降级和安装归属；普通位置变化不调用模型。
- 宿主层只绑定自己的聊天/Agent，传递执行阶段与决策事件。绑定使用会话证明，不读取聊天日志或按最近活动窗口猜测归属。
- 事件摘要只携带接续所需的会话、步骤、游标和事件类型。模型接收用户操作后，仍须观察原应用再核验。
- 用户拒绝后停止该步骤，不自动重开；中断、关闭和卸载释放自己的资源，不影响其他宿主。
- 本地绘制不会自动点击、批准或静默授予系统权限。受保护界面和缺少可靠坐标时使用无坐标引导。

## 本地常驻与 Agent 接续

常驻的是 Broker、事件和桌面状态，不是另一个持续推理的模型。附着会话可以按宿主公开事件接口交付决策事件；无事件时只做本地长等待。挂起会话继续保留桌面指引，用户回到原聊天后再核验。

Codex / Claude Code 的增强 Hooks 上报执行阶段并提供有界的轮次结束提醒，不承诺后台启动空闲模型轮次。DeepSeek / OpenCode 的原生事件接续需要对应版本的公开 Agent / session API，实际唤醒和退出行为分别实测。宿主没有接续接口时，界面显示“回到原会话继续”。

## 留在实机验收的项目

1. 七宿主逐个验证安装/信任/启用/重载、工具发现、实际绘制、人工操作、独立核验、下一步、停止与清理。
2. macOS 与 Windows 分别检查点击穿透、焦点、全屏应用、目标失效、进程重连；受保护窗口使用降级引导。
3. 物理多屏检查负坐标、混合 DPI、窗口跨屏和拔插；模拟布局测试不替代多台显示器。
4. 固定三类任务：普通设置、多步文件导入、敏感确认的拒绝/取消。分开记录本地时间与模型/宿主调度时间。

目标值为本地动作反馈 ≤100 ms；实际耗时须由任务记录给出。模型首字节、冷启动与本地热路径分别计量，不把单元测试时长当作体验指标。

## 后续迭代

根据真实任务结果再完善可预先确定的步骤图、局部目标预定位和恢复分支。现有工具不要求 Agent 提交尚未实现的步骤 DSL。长期分发再增加平台构建、版本兼容范围、商店流程；独立 App 签名不作为本地插件试用的前提。

官方接口：[Codex 插件](https://developers.openai.com/plugins/build/plugins) · [Codex Hooks](https://learn.chatgpt.com/docs/hooks) · [DSH Agent API](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/core/agent/README.md) · [Claude Code 插件](https://code.claude.com/docs/en/plugins-reference) · [OpenCode 插件](https://opencode.ai/docs/plugins/)
