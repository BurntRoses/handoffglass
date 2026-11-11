# Codex 本机插件试用

插件把 MCP、引导 Skill 和生命周期 Hooks 装在一起。会话开始时提供精简工作流；引导期间同步实际执行阶段；用户中断时暂停当前引导；会话结束时清理自己的引导。未结束的任务最多提供一次同状态接续提醒，避免直接丢下用户。

## 安装与试用

在已安装 Node 22+ 和项目依赖的仓库中运行：

```sh
npm run plugin:codex:install
```

安装器调用 Codex 自己的本地 marketplace 和 plugin 命令，保留其他插件与配置。已有独立的 HandoffGlass MCP 时先移除旧连接，避免重复工具。此包引用本机源码和 Node 路径，移动源码或运行时后需重新生成；不是自包含的社区安装包。

安装后打开新聊天，在 **设置 → Hooks → Review hooks** 审核 HandoffGlass 的脚本；CLI 使用 `/hooks`。这是 [Codex 的插件脚本信任要求](https://learn.chatgpt.com/docs/hooks)，安装器不会代为信任。脚本引用此仓库中的运行代码，审核时也应查看该本地源码。首次需要原生控件定位时，按权限检查结果完成辅助功能授权。

对 Codex 说：

```text
用 HandoffGlass 一步步教我打开当前应用的设置。等我操作后再继续，并检查操作结果。
```

可以先说“检查 HandoffGlass 插件是否已连接”，使用随包 `handoffglass:handoffglass-setup` Skill 检查连接和权限。不要另装同名 MCP 或 Skill。

## 停用与移除

临时关闭桌面引导：说“暂时停用 HandoffGlass”，或关闭 App 的桌面引导开关。会话和目标跟随停止，管理工具仍可用。若要连 Hooks/Skills 一起停用，在 Codex 插件设置中停用整个插件。

移除本插件与本机生成文件：

```sh
npm run plugin:codex:remove
```

也可说“从 Codex 移除 HandoffGlass 插件”，Agent 使用 `integration_cleanup`。App 的“移除 Codex 连接”和完整卸载使用同一服务；它调用 Codex 原生移除命令，清理自己的 marketplace、逐文件核对的生成包和此配置下的 Hook 绑定。改动过的文件和额外文件保留并列出。开发仓库保留。

直接在 Codex 中移除插件会由宿主管理缓存；如要连本项目生成的试用包和绑定记录一起清理，再执行上面的项目移除命令。清理不会编辑 Codex 的 Hook 信任数据库。

## 本轮验证

- 本机 Codex `0.167.0-alpha.3.2`：原生安装/加载、18 个 MCP 工具、两个 Skill、7 个待审核 Hooks、`screen_displays` 首调、公共卸载入口与重复清理通过。
- App 连接页会识别原生插件，显示“已安装 / 待重载 / 待审核 Hooks”，不会再把插件当作旧 MCP 重装。
- 原生测试使用临时配置和隔离的无桌面 Broker，不调用模型、不代替用户信任 Hooks。
- 此版本的根目录通用 `plugin.json` 能发现 Skill/MCP，但原生检查未列出 Hooks；试用包采用已实测的 `.codex-plugin/plugin.json` 与 `.mcp.json`。未来切换通用格式时必须重新通过宿主加载检查。
- 完整真实任务、用户审核后的 Hooks 触发、多屏与 Windows 尚需实机验收。
- 本轮 `handoff:check` 的 213 个测试、MCP/连接集成、真实 Electron UI 回归通过；UI 回归覆盖插件识别、重复接入拦截及审核提示。当前聊天已发现随包技能并成功读取真实桌面与权限状态。

```sh
npm run test:codex-plugin
```

此测试需要本机 Codex CLI；可用 `HANDOFFGLASS_CODEX_COMMAND` 指定可执行文件。CI 单元测试检查打包与绑定契约，不把缺少原生宿主的 CI 当作实机通过。

## 接续范围

后台 Hooks 不能启动已空闲的模型轮次。当前版本改善初始化、执行反馈与轮次结束时的接续；任意时刻自动唤醒、确定步骤的本地执行和跨 Harness 事件接续按[升级计划](NATIVE_PLUGIN_UPGRADE.md)推进。


## 0.19 快速绘制与挂起

说“在屏幕上画个圈”，Agent 直接调用 `screen_mark` 一次，标记默认 20 秒后清除。工具说明在初始化时给出，无需每次读取整份 Skill。更新插件后，新建聊天可发现新增工具。

任务可用 `execution:"parked"` 留在桌面；当前状态中也可选择“挂起会话”。窗口跟随和操作记录继续，聊天结束等待。返回原会话后接续并核实结果。Hooks 不会强制延长挂起任务，也不能主动唤醒空闲模型。
