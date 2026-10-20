<div align="center">

<img src="assets/brandmark.svg" alt="HandoffGlass" width="76" height="76" />

# HandoffGlass

**下一步，指给你看。**

为 AI Agent 打造的本地桌面交互层。把下一步指向屏幕，把决定交给用户，再让 Agent 接着完成任务。

[English](README.md) · [**简体中文**](README.zh-CN.md) · [日本語](README.ja.md)

<img src="assets/hero.svg" alt="HandoffGlass 桌面交接示意" width="100%" />

[快速开始](#快速开始) · [Agent 接入](#agent-接入) · [视觉系统](#视觉系统) · [文档](#文档)

</div>

[在 Codex 中使用 · 废纸篓引导提示词](docs/USE_WITH_CODEX.zh-CN.md)

## Agent 负责推进，关键一步交给你

登录、授权、选账户或确认设置。HandoffGlass 在真实桌面上指出操作位置，接收用户的决定，再把结果送回原来的 Agent。

<img src="assets/interaction-flow.svg" alt="Agent 与用户交接流程" width="100%" />

| 指得准 | 交得清 | 接得上 |
|---|---|---|
| 箭头、圈画、聚光与高亮 | 完成、拒绝与取消 | 控件跟随、状态事件与任务恢复 |

多个 Agent 共用同一个本地 Broker。设置中心统一管理 MCP 连接、视觉偏好、原生 UI 定位与诊断。

## 快速开始

**Node.js 22+** · **macOS / Windows**

```bash
git clone https://github.com/BurntRoses/handoffglass.git
cd handoffglass
npm ci
npm run verify
npm run configure
```

`npm run visual:trial` 试用六组动态笔触与真实 Agent 交接，`npm run gallery` 比较 13 种标注。详见 [Agent 视觉试用](docs/AGENT_VISUAL_TRIAL.md)。

**让 Codex 在本机继续开发？** 直接发送 [Codex 接手指南](docs/CODEX_HANDOFF.md)。Codex 自行获取仓库、配置环境、运行程序、测试、修改代码并提交 PR。

## Agent 接入

`Codex` · `Claude` · `Cursor` · `VS Code` · `Gemini CLI` · `Trae` · `Cline` · `Windsurf` · `OpenCode` · `Zed`

[DeepSeek Harness 插件](integrations/deepseek-harness/) · [WorkBuddy 连接器](integrations/workbuddy/) · [接入矩阵](docs/COMPATIBILITY.md)

## 视觉系统

六种场景模板、七种 SVG 元件、增量更新图层、仿手写圈画、柔光聚焦和原生控件跟随。桌面与场景实验室共用同一套渲染器。

```bash
npm run gallery
npm run scene:templates
npm run preferences -- set visualStyle=handdrawn
```

## 文档

[Codex 接手指南](docs/CODEX_HANDOFF.md) · [系统架构](docs/ARCHITECTURE.md) · [桌面设置中心](docs/CONTROL_CENTER.md) · [场景协议](docs/SCENE_PROTOCOL.md) · [视觉语言](docs/VISUAL_LANGUAGE.md) · [文档索引](docs/INDEX.md)

<sub>私有开发仓库 · v0.15 · UNLICENSED</sub>
