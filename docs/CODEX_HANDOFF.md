# Codex 本地接手指南

**项目：** [BurntRoses/handoffglass](https://github.com/BurntRoses/handoffglass)

**交接方式：** 从获取 GitHub 仓库开始，由 Codex 独立执行。包括拉取文件、阅读源码、安装环境、运行桌面程序、测试、修复、提交和创建 Pull Request。

## 1. 自行获取仓库

先检查当前工作区。如果已在该仓库，核对远程地址后直接更新；否则使用本机已有的 GitHub 认证克隆：

```bash
pwd
gh auth status
gh repo clone BurntRoses/handoffglass
cd handoffglass
git fetch origin
git status --short
git rev-parse HEAD
```

根据实际工作目录调整命令，无需让用户先手动下载或解压代码。建立 `codex/*` 工作分支。

## 2. 阅读并运行

按顺序阅读 `AGENTS.md`、`docs/ARCHITECTURE.md`、`docs/DESKTOP_QA.md` 与相关模块及其测试。

```bash
node --version
npm ci
npm run handoff:check
npm run test:integration
npm run test:extras
npm run connection:check
npm run doctor
npm run desktop:demo
```

记录操作系统、Git 提交、测试结果和可复现问题。遇到失败就定位并修改源码。

## 3. 完成真实桌面交接

连接 Codex MCP 配置，在本机使用测试窗口完成整条流程：

**Codex 发起 → 目标定位 → 视觉提示 → 用户操作 → 事件回传 → Codex 核验并继续。**

逐项测试窗口移动、尺寸变化、目标消失和恢复、显示器切换、不同 DPI、焦点与鼠标穿透、完成和拒绝、进程重启。

运行完整桌面界面，检查深浅主题、动效、字体及中英日文案。对问题直接修复并新增测试。

## 4. 工作优先级

1. **任务闭环：** MCP 接通、准确定位、状态回传与继续执行。
2. **桌面体验：** 窗口跟随、鼠标穿透、多屏、权限、动画与排版。
3. **安装发布：** 原生构建、安装升级、签名公证。
4. **宿主适配：** DeepSeek Harness、WorkBuddy、Trae 的真实调用测试。
5. **性能对照：** 准确率、耗时、模型调用次数及 token。

## 5. 提交

每轮完成 `npm run handoff:check`、MCP 集成测试和对应实机检查；推送独立分支并创建 PR，写清修改文件、测试结果、实际表现和下一步。

[架构](ARCHITECTURE.md) · [桌面验收](DESKTOP_QA.md) · [交互事件](INTERACTION_EVENTS.md) · [路线图](ROADMAP.md) · [文档索引](INDEX.md)
