# Roadmap

当前采用插件优先路线：运行快照、连续会话、分层绘制、共享能力目录，以及七宿主的安装、状态、启停与归属清理已形成实现。源码和协议预检入口是 `npm run test:preacceptance`；实现范围见[跨 Harness 进度](NATIVE_PLUGIN_UPGRADE.md)。以下真实宿主、系统与硬件验收继续保留。

## P0 · 真实桌面任务闭环

- [#1 桌面交互验收](https://github.com/BurntRoses/handoffglass/issues/1)：点击穿透、窗口焦点、全屏与多显示器、应用重启。
- [#3 原生目标定位](https://github.com/BurntRoses/handoffglass/issues/3)：macOS Accessibility、Windows UIA、窗口跟随、DPI 与目标恢复。
- [#9 Harness 实际接入](https://github.com/BurntRoses/handoffglass/issues/9)：按 Codex、Claude Code、DeepSeek Harness、WorkBuddy、Cursor、Trae、OpenCode 分别验收真实模型与人类闭环。

## P1 · 安装与日常体验

- [#4 安装发布](https://github.com/BurntRoses/handoffglass/issues/4)：插件安装、重载、升级与清理；独立 App 的签名与公证另行处理。
- 优化 Control Center、故障恢复、动态圈画、视觉层级和权限设置流程。
- 根据实机结果持续改进本地 UI 定位与交接体验。

## P2 · 效果实测

- [#10 性能与准确性](https://github.com/BurntRoses/handoffglass/issues/10)：比较文字提示、静态标注、动态跟随。
- 测量任务成功率、目标准确率、交接时长、工具调用和 token 使用量。

执行入口：[Codex 接手](CODEX_HANDOFF.md) · [桌面验收](DESKTOP_QA.md)。
