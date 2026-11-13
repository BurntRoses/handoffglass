# Codex 本机插件试用

插件默认包含 MCP 与引导 Skill。Codex 负责已授权的界面观察和结果核验，HandoffGlass 负责坐标转换、屏幕绘制、步骤卡片与事件。新安装默认 light，不运行命令 Hooks；已有安装保留原选择。

## 安装与试用

在已安装 Node 22+ 和项目依赖的仓库中运行：

```sh
npm run plugin:codex:install
```

安装器调用 Codex 自己的本地 marketplace 和 plugin 命令，保留其他插件与配置。已有独立的 HandoffGlass MCP 时先移除旧连接，避免重复工具。插件自带运行代码、生产依赖与本平台 Electron 绘制进程，便携包入口使用 `${PLUGIN_ROOT}`；本机安装使用插件管理目录内的稳定快照，兼容尚未解析该占位符的 Codex。安装后不依赖源码目录，也不要求另装独立 App。仍需 Node.js 22+；Node 安装被移除后须重新接入。Electron 由多个会话复用，仅在第一次绘制时启动；插件包含桌面运行时，不等于零体积或零进程。

安装后打开新聊天加载工具。屏幕绘制不需要 HandoffGlass 的辅助功能权限；宿主观察仍受自己的权限和目标限制约束。默认 host 工具目录包含精简的绘制与会话工具，隐藏可选原生查找及完整图层参数。

可选生命周期增强模式：`npm run plugin:codex:install -- --lifecycle=enhanced`。仅此模式需要在 **设置 → Hooks → Review hooks** 审核脚本（CLI：`/hooks`）。绘制不触发 Hooks；增强模式不在每次模型请求启动脚本。安装器不会代为信任。切回轻量模式用 `--lifecycle=light`。

对 Codex 说：

```text
用 HandoffGlass 一步步教我打开当前应用的设置。等我操作后再继续，并检查操作结果。
```

可以先说“检查 HandoffGlass 插件是否已连接”，使用随包 `handoffglass:handoffglass-setup` Skill 检查连接和权限。不要另装同名 MCP 或 Skill。

## 停用与移除

临时关闭桌面引导：说“暂时停用 HandoffGlass”，或关闭 App 的桌面引导开关。会话和目标跟随停止，管理工具仍可用。若要连 Hooks/Skills 一起停用，在 Codex 插件设置中停用整个插件，或让 Agent 使用 `integration_set_enabled({host:"codex",enabled:false})`。宿主需要重载后更新工具目录。

移除本插件与本机生成文件：

```sh
npm run plugin:codex:remove
```

也可说“从 Codex 移除 HandoffGlass 插件”，Agent 使用 `integration_cleanup`。App 的“移除 Codex 连接”和完整卸载使用同一服务；它调用 Codex 原生移除命令，清理自己的 marketplace、逐文件核对的生成包和此配置下的 Hook 绑定。改动过的文件和额外文件保留并列出。开发仓库保留。

直接在 Codex 中移除插件会由宿主管理缓存；如要连本项目生成的试用包和绑定记录一起清理，再执行上面的项目移除命令。清理不会编辑 Codex 的 Hook 信任数据库。

## 验证

App 内创建的 Codex 连接使用该 App 的运行时，连接页会显示依赖关系。它与源码安装的自带渲染器插件采用同一工具契约；卸载 App 前应通过“完整卸载”一起移除连接。

`npm run test:codex-plugin` 在临时 Codex 配置中验证原生安装与重装、19 个 MCP 工具、两个 Skill、light 模式无命令 Hook、首次调用及卸载清理。测试不调用模型或修改用户 Hook 信任。可用 `HANDOFFGLASS_CODEX_COMMAND` 指定 Codex CLI。

`npm run codex:readiness` 默认只读取本地安装和启用证据，分开显示工具加载、绘制授权和首次调用。加 `-- --probe-host` 才启动独立的无模型探测会话；它不能证明当前聊天已加载或允许绘制。实际调用时遇到宿主审批，由用户决定，见[审批诊断](CONNECTION_DIAGNOSTICS.md#codex-tool-approval)。

试用包采用已实测的 `.codex-plugin/plugin.json` 与 `.mcp.json`；通用根 manifest 在此前宿主版本中遗漏 Hooks，后续切换需重新验证。

## 接续范围

后台 Hooks 不能启动已空闲的模型轮次。增强模式同步执行阶段并提供有界的轮次结束接续提醒；挂起后回到原聊天继续。跨 Harness 的实现、版本边界和待验项目见[升级进度](NATIVE_PLUGIN_UPGRADE.md)。


## 0.19 快速绘制与挂起

说“在屏幕上画个圈”，Agent 直接调用 `screen_mark` 一次，标记默认 20 秒后清除。工具说明在初始化时给出，无需每次读取整份 Skill。更新插件后，新建聊天可发现新增工具。

任务可用 `execution:"parked"` 留在桌面；当前状态中也可选择“挂起会话”。窗口跟随和操作记录继续，聊天结束等待。返回原会话后接续并核实结果。Hooks 不会强制延长挂起任务，也不能主动唤醒空闲模型。

## 0.19.2 接续与设置修正

完成后的卡片保留“操作已记录”和返回会话的提示，不再自动藏进收起条。回到原聊天说“继续”后，Agent 接续并核实；桌面只提供挂起，不声称能唤醒空闲模型。暂停再继续会保留待核实结果。挂起和已结束的任务立即返回，不产生额外长等待。

设置只提交改动字段，由 Broker 顺序保存；保存外观不会重启已关闭的功能或改写定位授权。更新插件后打开新聊天加载版本。

MCP 重连和本地服务重启也保留待核实记录；已暂停的任务保持暂停。Agent 根据返回状态检查已有结果，避免让用户重复执行。

## 0.20 屏幕标注

升级后新建 Codex 会话，让宿主重新加载工具参数。可直接说：“在屏幕左侧画一个蓝色手绘椭圆，写上‘查看这里’”；随后说“移到右上角”或“清除刚才的标记”。绘制和修改各用一次 `screen_mark`，不进入长等待。App“外观”也能直接试画、更新与清除。参数与组合示例见 [屏幕标注](SCREEN_DRAWING.md)。

## 0.22 宿主观察优先

实际目标使用宿主观察的 bounds/frame 直接绘制；缺少原生定位权限不会中断这条路径。工具目录、模式和坐标边界见 [宿主观察与本地绘制](HOST_OBSERVATION.md)。Codex 自身窗口被 Computer Use 拒绝读取时，应说明限制，不绕过保护。
