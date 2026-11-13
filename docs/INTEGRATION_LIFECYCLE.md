# 停用与移除连接

应用、MCP 和 CLI 共用 `src/integration-lifecycle.mjs`，覆盖 Codex、Claude Code、DeepSeek Harness、WorkBuddy、Cursor、Trae、OpenCode。这里的“移除连接”清理宿主配置、引导技能或本地连接器包，不删除 HandoffGlass 应用程序。

## 用户入口

- 暂时不用：连接页关闭“桌面引导”，或告诉 Agent“暂时停用 HandoffGlass”。立即取消当前引导、清除目标跟随；外观和连接配置保留。
- 恢复使用：连接页打开开关，或告诉 Agent“重新启用 HandoffGlass”。不改变辅助功能授权。
- 移除连接：连接页选择应用 →“查看移除内容”→“移除连接”。也可告诉 Agent“从 Codex 移除 HandoffGlass 连接”。

Agent 调用 `integration_set_enabled({enabled:false|true})` 管理总开关；指定 `host` 只启停对应的自有接入。WorkBuddy 的宿主开关返回明确的人工操作提示。安装使用 `integration_install({host,confirm:false})` 预览，用户已经要求接入后可传 `confirm:true` 执行。移除时先读 `integration_status({host})`，再调用 `integration_cleanup({host,confirm:false})` 查看范围。用户明确要求移除后可直接传 `confirm:true` 执行，无需再次询问同一个意图。停用状态下，这些管理工具仍可调用。

```sh
npm run uninstall:host -- codex          # 预览
npm run uninstall:host -- codex --apply  # 执行
npm run uninstall:host -- workbuddy --apply
npm run uninstall:host -- claude-code --apply
npm run uninstall:host -- opencode --apply
npm run uninstall:host -- disable --apply
npm run uninstall:host -- enable --apply
```

## Codex

原生插件试用版使用单独的 `handoffglass-plugin-install.json`，由 Codex 原生命令管理安装和移除。公共清理服务同时识别插件和旧 MCP 记录；App、MCP 和卸载 CLI 均可清理。插件生成包按摘要删除，用户改动和新增文件保留；同一 Codex 配置的私有 Hook 绑定一并移除。详见[插件试用](CODEX_PLUGIN.md)。以下是独立 MCP 接入的恢复规则。

本版安装会在 Codex 配置目录写入私有安装记录 `handoffglass-install.json`，包含安装前后内容和本次备份清单。安装更新按记录更新“已安装版本”，不会因随包 Skill 升级而丢失原始恢复信息。

移除时：

1. 配置仍与安装版本相同，恢复原始文件；原先没有文件则移除文件。
2. 仅其他 TOML 内容发生变化时，删除本工具表或恢复安装前的同名表；解析器检查其他配置值保持一致。
3. Skill 和备份只有仍等于安装记录时才移除或恢复。用户修改过的内容返回 `retained` 并保留。
4. 所有已记录内容处理完成后移除安装记录。只删除空的 Skill 目录，不删除共享的 `skills` 目录。

写入使用临时文件、原子替换、写前比对和失败回滚。它不是跨文件的断电事务；进程被强制终止或磁盘故障后仍可能需要人工检查。旧版缺少安装记录时，只对能够核实归属的生成配置/技能进行迁移识别；无法核实的内容返回 `unmanaged` 并保留。旧备份和用户自行写入的记忆也不会被扫描清空。

移除后重启 Codex；已运行进程可能保留工具目录。本工具不会修改宿主审批策略、项目信任或系统权限。

## WorkBuddy

App 的“生成连接器”将 MCP、Skill、参考文件和图标写入本地运行目录中的 `connectors/workbuddy-local`，默认是 `~/.handoffglass/connectors/workbuddy-local`。“打开文件夹”供用户在 WorkBuddy 中导入。`npm run connector:workbuddy` 另生成开发包 `dist/workbuddy-local`。两者都有逐文件摘要清单，App、MCP 和卸载 CLI 均检查这两个固定位置。

重建前先检查全部已记录文件；有用户改动或未记录的同名文件时停止，原有内容保留。写入使用与 Codex 相同的写前比对和失败回滚。自动清理只移除清单内且未修改的文件；额外文件、修改过的图标或 Skill 均保留。自选导出目录需按导出记录自行处理，不按磁盘搜索删除。

本地包与 WorkBuddy 已导入的连接器是两个位置。当前没有读取或删除 WorkBuddy 内部信任、绑定状态的接口。先在 WorkBuddy 中停用并移除连接，再清理本地包。返回 `hostState:not_observed`、`hostAction:remove_connector_in_workbuddy`、`complete:false`；不把本地文件删除称为宿主完整卸载。

## 清理范围

连接移除保留外观偏好、只读控件定位选择和其他宿主配置。完整应用卸载使用下方安装清单与外部移除器。macOS Accessibility 权限由系统管理；不清空宿主历史或其他技能。平台实机验收状态见发布记录。

## Claude Code、DeepSeek、OpenCode、Cursor、Trae

五种宿主共用 `src/harness-installation.mjs`，安装与状态命令见[宿主插件与连接](HARNESS_PLUGINS.md)。每次安装保留稳定的安装 ID、运行包摘要、自有配置引用和原配置备份；更新先核对归属，同一安装的并发写入返回 `already_running`。

Claude Code 通过原生插件命令安装、启停、移除自有 user scope 插件与 marketplace，不编辑信任数据库。DeepSeek 只管理自己的 Cordis patch、运行包和启动器；停用需重新加载该 patch。OpenCode 只增删自有 `plugins` 路径，Cursor/Trae 只增删自有 MCP 项；JSONC 的注释、其他插件和其他配置保留。Trae 必须使用已记录的配置路径、用户选择的配置或明确的项目目录。

清理先移除宿主引用，再按摘要删除运行包；若用户改动引用，运行包一并保留，避免留下一条失效配置。`retained` 列出的修改和额外文件不删除；`complete:false` 表示还有保留项或宿主内步骤。安装/卸载失败保留可诊断的状态，不把文件写入成功当作宿主已加载。手工添加、没有安装记录的接入仍需按宿主配置核对后处理。

## 0.18 完整卸载

完整卸载与移除单个连接是两个动作。应用内“卸载 HandoffGlass”、Agent 的 `integration_uninstall` 和 `npm run uninstall:app -- --apply` 共用同一个实现；不带确认参数先返回清单。用户已经明确要求卸载时，Agent 可以直接在预览后执行。

打包应用首次运行记录应用标识、文件摘要和自有数据路径。完整卸载先准备独立的外部移除器，清理宿主引用；当前插件运行包和应用文件等到相关进程退出后才按摘要删除，避免卸载器先删掉自己的执行代码。新增或改动的文件返回 `retained`；开发仓库不属于应用删除范围。结果中的 `scheduled:true` 表示已安排，最终结果写入 `resultPath`，不能提前称作全部删除完毕。macOS 系统权限记录和 WorkBuddy 内部导入状态仍由对应系统/宿主管理。
