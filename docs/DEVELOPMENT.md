# 本地开发与打包

## 运行与验证

使用 Node.js 22 或更新版本。在仓库根目录执行：

```sh
npm ci
npm run handoff:check
npm run test:integration
npm run connection:check
```

桌面改动用 `npm run desktop:demo` 预览，再按[桌面验收](DESKTOP_QA.md)检查引导、绘制、焦点与权限。宿主接入及恢复流程见[宿主插件](HARNESS_PLUGINS.md)和[宿主验收](HOST_EVIDENCE.md)。

## 构建桌面包与插件

从干净的 Git 工作树构建，包内会记录源码提交。macOS 先执行 `npm run native:macos` 编译定位和截图助手，再执行 `npm run dist:desktop`。Windows 直接执行桌面构建命令。

```sh
node scripts/verify-package.mjs
npm run test:packaged
npm run verify:dist
```

在 macOS 构建内置桌面运行时的 Codex 插件前，同样先编译原生助手。以 `npm run plugin:codex` 生成插件，以 `npm run test:plugin-runtime` 检查迁移后的自带运行时，以 `npm run test:plugin-runtime:packaged` 检查由桌面包创建的插件。后者使用已登记的 App 渲染和处理原生操作。安装参数见 [Codex 插件](CODEX_PLUGIN.md)。

## 源码入口

| 内容 | 目录 |
|---|---|
| 工具、协议与宿主接入 | `src/mcp.mjs`、`src/config.mjs`、`src/hosts/`、`integrations/` |
| 会话、进程与通信 | `src/core.mjs`、`src/broker.mjs`、`src/bridge.mjs`、`src/runtime.mjs` |
| 桌面、坐标与绘制 | `src/desktop/`、`src/visual/`、`src/native/`、`native/` |
| 偏好和本地状态 | `src/local/` |
| 构建与验证 | `scripts/`、`test/`、`.github/workflows/` |

保持单一 Broker、会话隔离和独立的桌面通信凭据。定位使用系统实时数据或具有明确映射的画面，证据失效时清除旧标记。界面共用视觉规则、保留中英文本地化并尊重系统的减少动态效果设置。向主分支提交改动前，以 PR 运行跨平台检查。

[系统架构](ARCHITECTURE.md) · [界面规范](../DESIGN.md) · [文档索引](INDEX.md)
