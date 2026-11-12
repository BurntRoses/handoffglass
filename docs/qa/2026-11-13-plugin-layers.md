# 0.22 插件运行时与分层呈现

环境：macOS arm64，一台物理显示器；Node 24.22.1，Codex CLI 本机测试。用户将发布路线改为插件优先，签名独立 App 与自动更新延后。

## 已执行

- `handoff:check`：245 个测试通过，语法、仓库链接、版本、场景通过。
- `test:integration` / `mcp-smoke --host` / `connection:check`：full 20、host 18 个工具；游标、双宿主所有权、恢复与独立核验。
- `test:codex-plugin`：临时 Codex 配置中的原生安装/同版本更新、两个 Skill、light 无 Hooks、18 个工具、首次调用、卸载。未调用模型。
- `test:plugin-runtime`：复制插件后移动目录，用副本 MCP 与 Electron 实际绘制并清除；不使用已安装 App 或开发目录入口。
- `test:runtime-ui`：真实 SVG 呈现、图像区域映射、可逆展开收起、挂起、三层独立开关、审查、拒绝不重问、三态核验、主题与中英文、哈希折叠、键盘焦点。
- `test:release-ui`：控制中心、连接/清理、首次向导、停用、三步本地试用、原生绘制退场与暂停、长文本与窄窗口。键盘/指针通过渲染器可信输入检查，使用控件表面而无附加 outline/阴影环。
- `test:site`：18 个语言/窗口组合、场景切换、减少动态效果、复制降级、语言保存和演示分支。
- `release:check -- --preview`：工程预览检查通过；正式签名、Windows/多屏/宿主闭环仍在待验收项中。

## 性能范围

本地热路径绘制样本：HTTP 到 SVG DOM p95 约 16ms，Broker 处理 p95 约 2ms；不包括宿主观察、冷启动或模型。55 次本地游标样本（前 5 次预热）事件接收 p95 0.71ms；不包括 OS 输入和宿主调度。实际工具目录 host 比 full 小约 34%。完整数值由 `.tmp/runtime-ui/report.json` 和相应 benchmark 输出给出。

## 待实测

所有宿主的真实模型任务、人类决策、独立核验与继续任务仍为未验证。Claude Code / DeepSeek / OpenCode 已有可构建的本地原生入口和共享协议测试，尚未运行对应宿主。Windows、安全桌面、多物理显示器和混合 DPI 仍须对应设备；逻辑测试不替代这些验收。

默认安装仍要求 Git、Node.js 22+ 与 npm 准备源码依赖；插件包含本平台 Electron，不是零体积。Node 可执行文件须保留在稳定目录。便携构建使用宿主根目录占位符；当前 Codex 兼容安装使用插件管理目录内的稳定快照路径。
