# Agent 视觉引导试用

本轮目标是可交互的产品试用：生产笔触、真实 MCP、真实桌面覆盖窗口、原界面操作和事件回传共用一条流程。需要 Node 22+、Electron 和本地图形桌面。

```bash
npm ci
npm run visual:trial
```

1. 左侧切换手绘双圈、流动箭头、荧光笔、柔边聚焦、四角强调与呼吸落点。
2. 拖动试用窗口，观察标记跟随与描绘进度；点击「重新描绘」可重播。
3. 点击原界面的「打开项目」，在 HandoffGlass 交接面板中核对后点击「我已完成」。
4. 试用 Agent 读取 `session_wait`，再独立读取原界面项目状态，调用 `session_verify` 并显示核验结果。
5. 关闭试用窗口结束；临时 Broker、偏好和运行目录被清理。

试用 Agent 是同仓库的 MCP SDK 客户端，使用真实 stdio 工具与生产 Broker/覆盖层。目标坐标来自专用窗口实时 DOM 测量，加上 Electron 内容区的全局 DIP 原点；移动事件会触发带 revision 的场景更新。它用于验证接入契约，不包含任务规划模型，也不代替第三方原生应用验收。正常原生任务优先用 `target`，跟随由本地 AX/UIA 完成。

试用只改临时目录中的偏好，用户实际保存的偏好不变。关闭流程支持取消或拒绝；用户上报完成仍为 `completionSource:user_report, verified:false`。独立应用状态核验发生在 Agent 侧。

## 给当前 Agent 使用

仓库的 Codex MCP 配置仍指向 `src/mcp.mjs`。已运行的 MCP 进程保留旧工具枚举，更新源码后需在宿主中重新连接/加载 MCP 工具。

原生窗口已经可靠定位时，可直接使用新模板：

```json
{
  "title":"打开项目",
  "message":"请核对项目名称后打开。",
  "target":{"app":"YourApp","role":"button","name":"打开项目"},
  "template":"sketch",
  "timeoutSeconds":60
}
```

将 `YourApp` 和控件名称替换为真实前台原生目标，要求本机已启用只读定位及系统 Accessibility 权限。支持 `sketch`、`highlight`、`bracket` 以及原有六种模板。保存的用户风格与动态偏好优先。

复杂编排使用 `scene`，形状可选 `arrow/ring/box/spotlight/badge/underline/crosshair/highlight/bracket/check/scribble/halo/cursor`。以下是**字段示意**，坐标需来自当前任务的测量：

```json
{
  "title":"查看项目",
  "message":"先阅读更新时间，再打开项目。",
  "scene":{"version":1,"layers":[{"id":"guide","annotations":[
    {"id":"read","x":300,"y":240,"width":100,"height":20,"shape":"highlight","tone":"caution","effect":"draw","durationMs":850},
    {"id":"open","x":540,"y":400,"width":120,"height":40,"shape":"scribble","label":"打开项目","effect":"draw","delayMs":420,"durationMs":1100}
  ]}]}
}
```

使用 `session_update` 微调当前标注，保持稳定 ID；用户操作后先核验，再用 `session_present` 推进下一步；不能根据动画结束推断用户完成。增量事件与 compact 输出可减少重复上下文。所有逐帧描绘、羽化和呼吸在本地进行，不需要逐帧模型调用。

## 自动回归与视觉检查

```bash
npm run handoff:check
npm run test:integration
npm run test:extras
npm run test:visual -- --output=.tmp/visual-qa
npm run test:native:macos
npm run gallery
```

`test:visual` 自动点击专用测试按钮与交接面板，是合成操作回归；不能记为人工验收。可选截图只合成专用窗口和生产覆盖层，不读取其他应用。它记录真实描边进度、移动耗时、24 次 MCP 更新的 p50/p95 和最终事件。原生回归则使用独立 AppKit 控件及真实 Accessibility helper，覆盖手绘模板的移动、隐藏、恢复和缩放。

[视觉语言](VISUAL_LANGUAGE.md) · [动效规则](VISUAL_MOTION.md) · [场景协议](SCENE_PROTOCOL.md) · [桌面验收](DESKTOP_QA.md)
