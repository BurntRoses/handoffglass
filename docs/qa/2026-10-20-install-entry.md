# 简明安装入口 · 2026-10-20

平台：macOS ARM64。版本：0.17.0。

## 改动

- 用户只需发送 `请安装 https://github.com/BurntRoses/handoffglass`。
- `AGENTS.md` 先区分安装与开发，安装路径不再误入继续开发、建分支或提 PR 的流程。
- `docs/INSTALL_AGENT.md` 约定从默认主分支安装到持久位置，由 Agent 处理运行环境、当前宿主配置合并、引导技能和连接检查。
- 自动调用沿用 MCP 初始化指令和可隐式选择的技能；Computer Use 需要用户操作时，观察、指引、等待、复核后继续。
- 英、中、日 README 和网页安装入口同步简化，配置与开发细节移入文档。

## 验证

- `npm run handoff:check`：139 tests passed；语法、文档链接、版本和场景检查通过。
- `npm run test:integration` / `npm run test:extras`：10 / 13 tools，初始化指令、双客户端、所有权、取消与场景通过。
- `npm run connection:check`：passed，10 tools，`hostVerified:false`；这是隔离检查，不冒充当前宿主已加载。
- 在真实浏览器查看中文安装页，切换英文与日文，内容正确；首页与安装页复制后读取到相同的完整中文安装请求；首页到使用页的链接保留语言偏好。
- [安装页截图](assets/simple-install.jpg)。

本轮没有重新安装当前用户的 MCP、启动清理任务或删除真实文件。新的安装文档未经过另一模型在全新设备上的行为验收；协议检查不能证明所有宿主都会自动调用。

## GitHub 检查限制

GitHub Actions 的检查在执行任何 step 前即失败。Checks annotation：`The job was not started because recent account payments have failed or your spending limit needs to be increased.` 本轮使用本地检查结果，没有修改计费设置、移除 CI 或伪造成功状态。
