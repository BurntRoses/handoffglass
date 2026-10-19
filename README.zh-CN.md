<div align="center">

<img src="assets/brandmark.svg" alt="HandoffGlass" width="76" height="76" />

# HandoffGlass

**下一步，指给你看。**

给 AI Agent 用的本地交互层。指明屏幕上的下一步，让人接手必要的操作，再把结果交还原来的 Agent。

[English](README.md) · [**简体中文**](README.zh-CN.md) · [日本語](README.ja.md)

[快速开始](#快速开始) · [Agent 接入](#agent-接入) · [视觉系统](#视觉系统) · [项目文档](#项目文档)

<img src="assets/hero.svg" alt="HandoffGlass 桌面引导与人工交接的概念示意图" width="100%" />

</div>

[逐步安装与接入](site/getting-started.html)

[首次启动与桌面安装](docs/ONBOARDING.md)

[品牌与应用图标](docs/BRAND.md) · [界面设计规范](docs/INTERFACE_SYSTEM.md)

## Agent 做事，关键一步由你决定

登录、授权、选账户、确认设置。有些操作需要人亲自完成。HandoffGlass 在真实桌面上指出位置、展示必要的说明，并把用户的选择反馈给 Agent，让任务接着往下走。

| | |
|:--|:--|
| **指得准** | 箭头、圈画、聚光遮罩与可更新的图层。 |
| **交得清** | 独立的人工接管面板，明确区分完成、拒绝与取消。 |
| **接得上** | 结构化返回会话状态，实际结果仍由 Agent 核验。 |
| **留在本地** | 多 Agent 共用本机服务；原生 UI 定位按需授权；视觉偏好本地保存。 |

### 桌面设置中心

从托盘打开 **Control Center**，可查看本地服务状态、复制各 Agent 的 MCP 配置、调整外观与动效、管理只读定位权限，并运行不含隐私内容的诊断。近期 MCP 请求不等于某个宿主已经完成连接。详见 [设置中心文档](docs/CONTROL_CENTER.md)。

## 交接如何发生

<img src="assets/interaction-flow.svg" alt="Agent, human and agent handoff flow" width="100%" />

运行 `npm run gallery` 查看 [场景模板实验室](examples/scene-gallery.html)，或运行 `npm run site:preview` 体验[多语言产品展示页](site/index.html)。

本机 MCP 连接自检：`npm run connection:check`。显示器坐标图、错误码和脱敏报告见[连接诊断指南](docs/CONNECTION_DIAGNOSTICS.md)。

## 快速开始

**Node.js 22+** · **Windows / macOS** · 支持 MCP 的本地 Agent

```bash
git clone https://github.com/BurntRoses/handoffglass.git
cd handoffglass
npm ci
npm run verify
npm run configure
```

配置生成器会为当前机器提供接入参数。也可以在支持 stdio MCP 的客户端中添加：

```json
{
  "mcpServers": {
    "handoffglass": {
      "command": "node",
      "args": ["/absolute/path/to/handoffglass/src/mcp.mjs"]
    }
  }
}
```

不同宿主的格式由配置生成器处理。要直接测试真实桌面遮罩，运行 `npm run desktop:demo`；安装包与平台说明见[桌面运行时](docs/NATIVE_RUNTIME.md)。

**准备在本地继续开发？** 阅读 [Codex 交接与实机验收](docs/CODEX_HANDOFF.md) 和 [文档导航](docs/INDEX.md)。

## Agent 接入

**同一个本地 Broker，服务不同 Agent。**

`Claude Code` · `Codex` · `Cursor` · `VS Code` · `Gemini CLI` · `TRAE` · `Cline` · `Windsurf` · `OpenCode` · `Zed`

另有 [DeepSeek Harness Cordis 插件](integrations/deepseek-harness/)和 [WorkBuddy MCP + Skill 连接器](integrations/workbuddy/)；这两条集成路径仍需在真实宿主中完成验收。详见[兼容矩阵](docs/COMPATIBILITY.md)和[国产 Harness 接入](docs/CHINA_HARNESS_INTEGRATION.md)。

## 视觉系统

六种场景模板、七种 SVG 基础形状。图层可以增量更新，手绘圈画、柔光聚焦和渐进提示都由同一套渲染器呈现。

```bash
npm run gallery
npm run scene:templates
npm run preferences -- set visualStyle=handdrawn
```

用户设置优先于 Agent 的视觉请求。定位控件需要明确授权；HandoffGlass 负责引导，不代替用户点击或确认。

## 项目文档

| 视觉与交互 | 技术实现 | 平台接入 |
|:--|:--|:--|
| [视觉语言](docs/VISUAL_LANGUAGE.md) | [系统架构](docs/ARCHITECTURE.md) | [兼容矩阵](docs/COMPATIBILITY.md) |
| [场景协议](docs/SCENE_PROTOCOL.md) | [Agent Skill](skills/visual-handoff/SKILL.md) | [桌面运行时](docs/NATIVE_RUNTIME.md) |
| [动态效果](docs/VISUAL_MOTION.md) | [开发指南](AGENTS.md) | [安全与隐私](docs/SECURITY.md) |

<sub>私有工程预览版。Windows / macOS 安装程序尚未签名；CI 已验证构建与 MCP 启动，桌面交互仍需实机验收。当前仓库未开放使用许可（UNLICENSED）。</sub>

连接证据与安全校验：[本地宿主活动](docs/HOST_ACTIVITY.md) · [显示器定位复核](docs/GEOMETRY_RECHECK.md)。

