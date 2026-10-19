# 桌面实机验收 · macOS / Windows

由 Codex 在本机组织、执行并记录。每项附系统版本、显示器布局、构建提交、观察结果和对应修复。

先执行 `npm run test:desktop`：在隔离的临时运行目录中启动真实 Electron，分别验证普通 Node MCP、独立桌面、Electron Node 模式 MCP 的启动、双客户端复用 Broker、显示器连接与引导取消。随后核对覆盖窗口的全屏 DIP 边界、焦点保持和显示器变化后的重建。需要图形桌面与 Electron；模拟布局事件不代表通过物理外接屏验收。

macOS 执行 `npm run test:native:macos`：编译独立 AppKit 测试窗口，通过真实 Broker、原生 helper 和覆盖窗口验证移动、隐藏、恢复及缩放。约 20 秒内保持测试窗口前台且无遮挡；需要 Xcode 命令行工具和 helper 已有的系统 Accessibility 权限。检查只在临时 Broker 中启用只读定位，不修改用户偏好或系统授权。分别报告中心误差、尺寸误差和更新耗时；圆角按钮 AX 边框可比视图边框每侧多 1 DIP。

打包后执行 `npm run test:packaged` 和 `npm run test:desktop:packaged`：分别检查包内 headless MCP/原生 helper 路径，以及真实独立桌面和包内 MCP 自动唤起桌面。后者需要图形桌面，不能由前者替代。

## 启动与安装

- [ ] 从安装包启动 HandoffGlass；打开首次启动向导与设置中心。
- [ ] 生成 Codex MCP 配置，完成真实工具调用。
- [ ] 同时启动两个 MCP 客户端，确认共用同一个 Broker。
- [ ] 退出、重启、升级与卸载，核对托盘、图标和窗口状态。

## 交接体验

- [ ] Codex 发起引导；目标控件的箭头、圈画和说明正确显示。
- [ ] 透过遮罩正常点击、输入与切换原应用。
- [ ] 移动与缩放窗口，测量高亮跟随偏差和更新耗时。
- [ ] 隐藏目标与切换前台应用，确认旧标注消失；目标恢复后重新定位。
- [ ] 分别完成、拒绝、取消交接；Codex 收到正确事件并继续任务。
- [ ] 验证中文、英文、日文、深浅色、减少动态效果与键盘操作。

## 定位与多屏

- [ ] 启用只读 Accessibility 检查，定位唯一名称与角色的按钮。
- [ ] 测试重名、不可见、不可操作和遮挡控件。
- [ ] 将外接显示器放在主屏左侧，检查负坐标定位。
- [ ] 改变缩放倍率、断开并重新接入外屏，检查定位复核。
- [ ] 验证受保护窗口通过常规人工交接继续流程。

## 故障与恢复

- [ ] 分别重启 MCP 客户端、Electron 界面和 Broker。
- [ ] 另一宿主无法接管或修改已有宿主的会话。
- [ ] 检查 `handoff_events`、状态游标和 Control Center 时间线。
- [ ] 对照原应用状态验证用户操作后的任务结果。

## 验收记录

```text
Commit / version:
System / display:
Agent / scenario:
Expected:
Observed:
Reproduction:
Fix / test / PR:
```

[项目 Issues](https://github.com/BurntRoses/handoffglass/issues) · [Codex 接手](CODEX_HANDOFF.md)
