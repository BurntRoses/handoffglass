# 社区发布检查 · 2026-10-21

本轮检查面向新的社区安装，不修改实际宿主配置。基于 `520fa5c` 继续；本地构建环境为 macOS / arm64、Node 24.19.0、Electron 44.8.0。

## 修复

| 发现 | 修改 |
|---|---|
| GitHub 仓库已公开，说明却仍称私有、未许可；社区用户无法判断使用权 | 按维护者选择采用 PolyForm Noncommercial 1.0.0 官方全文，加入 Required Notice、中英日使用说明与网站标识；商业用途需另行授权，不宣传为 OSI 开源 |
| `npx` 临时解析旧构建器，干净机器依赖路径与本机不同 | 将 electron-builder 26.15.3 固定进项目与 lockfile，普通安装省去 devDependencies；Node-gyp 不再依赖 Git URL |
| 原 26.0.12 工具链审计报告 11 项高危、1 项严重问题 | 升级构建链后无高危或严重报告；CI 增加 `npm audit --audit-level=high` |
| npm 成功退出、Electron 模块可解析，但可执行文件未下载 | doctor 增加 `--desktop`，检查真实可执行文件，缺失时在安装阶段失败并提供修复命令；readiness 同步 |
| 桌面包带入 Electron npm 下载器和安装依赖 | 排除 optional/devOptional 安装阶段文件，保留内嵌 Electron 与实际 MCP 运行依赖 |
| 下载文件只有扩展名/大小检查，旧归档可能混入本次发布 | 精确版本/架构/安装类型，ASAR 版本与提交检查，原生 helper 架构、构建回执、流式哈希、只暂存本次下载文件 |
| `dist/` 整目录上传，可能夹带旧包、调试文件和本机连接器 | 独立 OS/架构输出和 `release/` 暂存；只上传下载文件、SHA256 和机器可读清单 |
| 包未主动携带运行依赖许可 | 构建时收集第三方声明及 Electron/Chromium 许可，包内校验缺一即失败；本项目 LICENSE / NOTICE 同步打包 |
| 配置生成被描述为真实宿主验证，Claude Desktop / Code 混写 | 重写兼容矩阵，区分配置、隔离 preflight、包内调用和宿主任务；`hostVerified:false` 保留 |
| 缺少可执行的发布状态和社区问题入口 | `release:check --preview/--public`、待验收证据表、升级/回滚/卸载说明、贡献指南、脱敏问题模板与私密安全报告入口 |

公开仓库状态来自 GitHub API 的只读检查；没有改仓库可见性、发布版本、启用自动更新或操作真实宿主安装。

## 验证

- `npm ci --include=optional` 完成；当前 npm 策略跳过了 Electron 安装脚本，执行其锁定版本的 `install.js` 后 doctor 检查通过。该情形已加入回归测试。
- `npm run handoff:check`：171 项测试通过，语法、链接、覆盖层生成和场景检查通过。
- MCP 默认 / extras / legacy：15 / 18 / 22 个工具；连续会话、所有权、初始化规则、Schema 示例与生命周期检查通过。
- 隔离新目录执行生产依赖安装：Electron 与 MCP 依赖可用，构建器未安装；15 工具 preflight 和可执行文件检查通过。全部临时文件已清理。
- macOS arm64 ZIP 构建、包内版本/架构/资源/许可检查、15 工具 MCP、临时 Codex 安装和 WorkBuddy 生成/清理通过。构建明确标记为未签名工程预览。
- 打包前后同一版本对比：下载 ZIP 约 259 MB → 133 MB；不是模型推理速度或桌面实际绘制基准。
- 篡改构建回执后，下载验证按预期拒绝；恢复回执后正常通过。
- 三个 YAML 文件解析通过。新增 PR 打包矩阵包含 macOS arm64、macOS Intel、Windows x64；远端执行结果另见 PR，不把本地构建当作其他平台已通过。
- 依赖审计：运行依赖（含 Electron 可选安装）无已报告漏洞；完整开发依赖剩 8 项中等报告，来自 `@electron/get → global-agent → roarr → sprintf-js` 链。`sprintf-js` 当前上游最高为 1.1.3，未有修复；这些构建依赖不随成品交付。未使用 `audit fix --force` 降级构建器。
- `release:check --public` 按预期失败：许可证阻塞已解除，签名和实机宿主证据仍待完成。

## 发布边界

尚未完成 macOS 签名/公证、Windows 签名与实机安装验收、物理多屏/DPI 和正式 Codex/WorkBuddy 的完整模型任务。CI 构建与包内 MCP 测试不能替代这些结果。

连接清理覆盖有记录的 Codex 内容及生成的 WorkBuddy 本地包。其他宿主配置、WorkBuddy 内部导入状态、应用程序自身、未知文件、偏好和系统授权不在自动删除范围。本轮没有把部分清理标成“完整卸载”。Broker 内存会话恢复、宿主空闲后自动唤醒和原始 2.0 全量 UI 仍沿用前轮记录的限制。

详见 [社区构建](../COMMUNITY_RELEASE.md)、[许可说明](../LICENSING.md)、[发布状态](../release-status.json)和[前轮审查](2026-10-20-lifecycle-audit.md)。
