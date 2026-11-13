# 桌面实机验收 · macOS / Windows

由 Codex 在本机组织、执行并记录。每项附系统版本、显示器布局、构建提交、观察结果和对应修复。

先执行 `npm run test:desktop`：在隔离的临时运行目录中启动真实 Electron，分别验证普通 Node MCP、独立桌面、Electron Node 模式 MCP 的启动、双客户端复用 Broker、显示器连接与引导取消。随后核对覆盖窗口的全屏 DIP 边界、焦点保持和显示器变化后的重建。需要图形桌面与 Electron；模拟布局事件不代表通过物理外接屏验收。

macOS 执行 `npm run test:native:macos`：编译独立 AppKit 测试窗口，通过真实 Broker、原生 helper 和覆盖窗口验证移动、隐藏、恢复及缩放。约 20 秒内保持测试窗口前台且无遮挡；需要 Xcode 命令行工具和 helper 已有的系统 Accessibility 权限。检查只在临时 Broker 中启用只读定位，不修改用户偏好或系统授权。分别报告中心误差、尺寸误差和更新耗时；圆角按钮 AX 边框可比视图边框每侧多 1 DIP。

打包后执行 `npm run test:packaged` 和 `npm run test:desktop:packaged`：分别检查包内 headless MCP/原生 helper 路径，以及真实独立桌面和包内 MCP 自动唤起桌面。后者需要图形桌面，不能由前者替代。

先运行 `npm run visual:trial` 完成 [六组笔触与 Agent 交接试用](AGENT_VISUAL_TRIAL.md)。`npm run test:visual -- --output=.tmp/visual-qa` 为真实 Electron 的合成操作回归，检查描绘进度、坐标更新后不重播、减少动态效果、焦点和 MCP 事件；人工视觉感受另行记录。

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
- [ ] 验证桌面中文、英文、深浅色、减少动态效果与键盘操作。网站另验中英日文；桌面尚不支持日文。

## 定位与多屏

- [ ] 启用只读 Accessibility 检查，定位唯一名称与角色的按钮。
- [ ] 测试重名、不可见、不可操作和遮挡控件。
- [ ] 将外接显示器放在主屏左侧，检查负坐标定位。
- [ ] 改变缩放倍率、断开并重新接入外屏，检查定位复核。
- [ ] 验证受保护窗口通过常规人工交接继续流程。

## 故障与恢复

- [ ] 分别重启 MCP 客户端、Electron 界面和 Broker。
- [ ] 另一宿主无法接管或修改已有宿主的会话。
- [ ] 检查 `session_wait`、状态游标和 Control Center 时间线。
- [ ] 对照原应用状态验证用户操作后的任务结果。

## 验收记录

`docs/release-status.json` 中的 `windowsDesktop`、`multiDisplay` 保持 `pending`，直到完成对应实机检查。通过后，`record` 指向仓库内的 JSON 记录，再将该项设为 `verified`。`npm run release:check:plugin` 会检查记录内容；仅创建文件或写入“通过”无法通过检查。

记录格式如下。字段值必须来自实际设备与观察，下面是字段说明，不是验收结果：

| 字段 | 内容 |
|---|---|
| `schemaVersion` / `kind` | `1`；`windowsDesktop` 或 `multiDisplay`，与发布矩阵项目一致 |
| `observedAt` | 实际验收时间，UTC ISO 格式，如 `2026-11-13T15:00:00Z` |
| `build` | `{ "version": "被测版本", "commit": "完整 Git 提交哈希" }` |
| `platform` | `{ "os": "win32 或 darwin", "arch": "x64 或 arm64", "version": "实际系统版本" }`；Windows 项只接受 `win32-x64` |
| `environment` | `physical-desktop`；无头测试、虚拟布局事件不能替代实机 |
| `displays` | 实际显示器数组，每项包括 `id`（本次记录的简短代号）、`physical: true`、`primary`、`bounds: { x, y, width, height }`（DIP）及 `scaleFactor`；恰有一个主屏 |
| `checks` | 下表列出的每项都包含 `{ "result": "passed", "observed": "具体观察结果" }` |
| `limitations` | 可选的简短限制列表；影响必需检查的问题修复后再标记通过 |

| 记录类型 | 必需检查 |
|---|---|
| `windowsDesktop` | `launch`：启动与连接；`overlay`：标注显示；`input_passthrough`：鼠标穿透与焦点；`handoff`：用户操作、独立核验及任务继续；`restart_cleanup`：重启恢复与卸载清理 |
| `multiDisplay` | `cross_display`：跨屏移动与跟随；`negative_coordinates`：外屏位于主屏左侧或上侧；`scale_change`：缩放变化后的复核；`hotplug`：外屏断开与重接。至少两台物理显示器，布局须包含负坐标 |

观察摘要写明操作和结果，不收录截图、账户、窗口标题、原始会话或凭据。校验器检查记录完整性；实机结果仍需实际观察。Codex 及其他宿主任务另记入 [宿主验收矩阵](HOST_EVIDENCE.md)。

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
