# 桌面实机验收 · macOS / Windows

由 Codex 在本机组织、执行并记录。每项附系统版本、显示器布局、构建提交、观察结果和对应修复。

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
