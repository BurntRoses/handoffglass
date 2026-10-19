# HandoffGlass · Codex 工程规则

## 接手入口

从 [Codex 接手指南](docs/CODEX_HANDOFF.md) 开始。Codex 自行获取 GitHub 私有仓库、建立工作分支、配置环境、运行程序和测试、修复问题、提交 PR。

## 目标

把 HandoffGlass 打磨成稳定、精确、美观的原生桌面交接工具。先完成真实 Codex → HandoffGlass → 用户 → Codex 任务闭环，再处理定位精度、桌面交互、安装发布与其他 Harness。

## 代码地图

| 工作内容 | 源码入口 |
|---|---|
| MCP 工具 / 配置 | `src/mcp.mjs`、`src/config.mjs`、`src/hosts/` |
| 会话 / Broker / 通信 | `src/core.mjs`、`src/broker.mjs`、`src/bridge.mjs`、`src/runtime.mjs` |
| 桌面界面 | `src/desktop/` |
| 标注与场景 | `src/visual/` |
| UI 定位与跟随 | `src/native/`、`native/` |
| 事件 / 偏好 / 策略 | `src/local/` |
| 宿主适配 | `integrations/`、`skills/` |
| 构建与验收 | `scripts/`、`test/`、`.github/workflows/` |

## 工程约定

- 保持单一 Broker、会话所有权隔离和桌面/Agent 独立通信凭据。
- 原生坐标以实时 AX/UIA 证据为依据；目标失效后清除旧标注并重新定位。
- 关键授权与确认由用户完成；Agent 使用实际应用状态核验结果。
- 保持 MCP 接口兼容、Electron 可选以及界面资源本地化。
- 视觉改动同步更新生产渲染器、预览和测试，尊重系统减少动态效果的设置。
- 文档采用简洁直接的写法，记录操作、结果和真实问题。

## 工作节奏

1. 自动获取或更新仓库，创建 `codex/*` 分支。
2. 运行 `npm ci`、`npm run handoff:check`、`npm run test:integration`、`npm run connection:check`。
3. 在本地运行 `npm run desktop:demo`，完成 [桌面验收](docs/DESKTOP_QA.md)。
4. 修复可复现的问题，编写回归测试。
5. 推送分支并创建 PR，附上执行结果和下一项工作。

[系统架构](docs/ARCHITECTURE.md) · [开发路线图](docs/ROADMAP.md) · [文档索引](docs/INDEX.md)
