# HandoffGlass v0.2 — 实施与验收报告

日期：2026-10-17

## 产品定位

通过 MCP/Agent Skill 为已有 Agent 增加“桌面标注 → 请求人类操作 → 明确反馈 → Agent 独立验证后恢复”的可复用工具能力。不替代 Computer Use，不自动批准权限，不绕过人机验证。

## 本轮实质改造

1. 重写会话状态机：输入验证、不可变终态、TTL 到期、拒绝/取消/超时/覆盖、结果复制隔离；`completed` 明确标记 `completionSource=user_report`、`verified=false`。
2. 扩展工具参数：最多 8 个独立屏幕标注，四种形状，尺寸/标签/颜色；支持**无坐标人工接管**，避免模型凭空猜坐标。
3. 重写本地 Bridge：随机 Bearer、仅监听 127.0.0.1、Host/Origin/Content-Type 校验、请求大小限制、版本号快照、长轮询多订阅、断线重连不重放旧事件。
4. 更新 Electron：多显示器 DIP 坐标变换、点击穿透、结构化 SVG 绘制、交接面板、按会话 ID 提交人工决定、WebContents 导航拦截和权限拒绝。
5. 新增官方 MCP v2 SDK 的客户端握手冒烟测试脚本和不依赖 Agent 的实际桌面烟雾测试脚本。
6. 更新 Skill、配置示例、CI、多语言开发文档、隐私/威胁模型与路线图。
7. 改进浏览器演示：把原应用动作、用户自报完成、Agent 独立核实拆为三个状态。

## 当前环境验收结果

- `npm run check`: **通过**（核心、Bridge、MCP、Electron 主进程与渲染脚本语法检查）
- `npm test`: **16/16 通过**（Node 核心/Bridge/几何与安全边界）
- `npm run demo`: **HTTP 200**（模拟产品演示服务）
- `npm run test:integration`: **未执行**（当前环境没有成功安装 MCP Client/Server SDK 依赖）
- `npm run desktop:demo`: **未执行**（当前运行容器不是目标 Windows/macOS 图形桌面）
- GitHub Actions: 已编写 workflow；**尚未实际触发**。

## GitHub 状态

2026-10-17 用户已新建 `BurntRoses/handoffglass` 私有仓库，已确认账号具备推送权限。此前“仓库不存在”的记录属于上一轮历史状态。GitHub Actions 是否实际执行成功须以仓库 Actions 页面为准。

## 必须避免的夸大

- 还没有视觉大模型理解屏幕、自动寻找按钮或基于 Accessibility API 进行元素定位。
- 不能保证在 UAC secure desktop / OS 受保护对话框上绘制。
- 没有 Windows/macOS 实机 UI 运行证明，也没有完成签名安装包。
- MCP 状态上的 `completed` 不是目标应用已成功的证据。
- 使用 GitHub 工具审阅官方开源项目，不等于已经将此项目代码推送至 GitHub。

## 推荐的下一轮工作（按优先级）

1. 安装依赖后执行 `npm run test:integration` 和 Windows/macOS `npm run desktop:demo`，记录真实窗口边界、DPI 及全屏行为。
2. 将源代码提交至私有仓库并使用 GitHub Actions 验证 3 个平台的测试。
3. 开发单实例本机 Broker，避免多个 MCP Host 启动重叠标注进程。
4. 增加 macOS Accessibility 与 Windows UI Automation 的目标定位，实现可信的元素坐标与窗口移动后自动更新。
5. 建立可量化用户测试：定位错误率、人工任务完成率、恢复成功率、额外 tokens 与延时、拒绝路径安全性。
