# HandoffGlass v0.3 — 实施与测试报告

2026-10-17 · 私有仓库 `BurntRoses/handoffglass`

## 定位

以 MCP 工具 + Agent Skill 的形式，让已有计算机操作 Agent 通过本地屏幕标注向用户移交指定步骤，再读取用户结果并由原 Agent 独立验证。项目不截取密码、验证码或界面内容；本身不提供 Computer Use 和 UI 语义识别。

## 本轮代码变更

1. **多宿主 Broker**：`src/mcp.mjs` 改为无状态 MCP 入口；`src/broker.mjs` 实现后台单实例进程；`src/runtime.mjs` 提供私有运行目录、启动锁、清单校验与自动恢复。
2. **授权和仲裁**：Agent 请求与桌面渲染使用不同 Bearer Token。每个 MCP Host 有唯一 owner ID；独立 Agent 不能读取、取消、覆盖其他 Host 的会话。
3. **失败处理**：Broker 重启后会话数据不持久化，旧会话不会被误认为完成；支持 status/stop CLI；桌面重启要求重新握手。
4. **稳定性**：防止窗口显示结构更新事件重复触发，补充双宿主 MCP 集成测试和 Broker 崩溃恢复测试。
5. **接入工具**：增加可移植的配置生成器（Claude JSON / Codex TOML），只输出配置不覆盖已有 Agent 设置。
6. **工程文档**：完善架构、隐私威胁模型、变更记录、跨平台桌面手工验收清单和路线图。

## 已在本地实测

- Node.js 22.16.0（Linux 无图形环境）下 `npm run verify`：**22 项单元、Bridge、Broker 集成测试通过**。
- `node --check`：全部目标 JavaScript 文件语法检查通过。
- `HANDOFFGLASS_HEADLESS=1` Broker 生命周期、并发启动、身份隔离和恢复：通过。

## 尚未证明

- `npm run test:integration`：当前 Linux 容器缺少在线安装的 MCP SDK 和 Electron，已在上一轮 GitHub Actions 跨平台成功执行；本次锁定依赖版本后应重新执行。
- Electron 实际悬浮、跨显示器、点击穿透以及 Mac/Windows 安装包：需交互式桌面验收；GitHub CI 无法替代真实桌面。
- UI 语义定位、动态按钮跟随、完整实时语音/视频：未实现。
- 成功提交 GitHub 与后续 CI 状态需以对应 commit 和 GitHub Actions 实际结果为准，不以此预先断言。

## 推荐顺序

1. 等待 GitHub Actions 跨平台 SDK 集成通过；必要时修复失败日志。
2. 在真实 macOS/Windows 设备执行 `docs/DESKTOP_QA.md`，解决窗口层级、输入焦点和多屏显示差异。
3. 生成版本锁文件和经过检验的免配置桌面安装包。
4. 分别实现 macOS Accessibility、Windows UI Automation 和浏览器 DOM 适配器；优先把按钮定位从模糊截图猜测提升为可验证的 UI 元素身份。
