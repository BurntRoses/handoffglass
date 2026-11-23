<div align="center">

<img src="assets/brandmark.svg" alt="HandoffGlass" width="76" height="76" />

# HandoffGlass

**Agent 的桌面标注与操作引导**

[English](README.md) · [**简体中文**](README.zh-CN.md)

</div>

Agent 通过 Computer Use 找到目标后，可以直接调用 HandoffGlass，在当前应用界面上圈出按钮、指向菜单或高亮输入框。需要你操作时，标记旁会出现一张步骤卡，告诉你接下来做什么。

![HandoffGlass 圈出每日提醒开关，旁边显示步骤卡片](assets/desktop-guidance-zh-CN.png)

*在示例应用中，Agent 圈出「每日提醒」开关，提示你打开它。*

## 一句话安装

把这句话发给本机 Codex：

```text
请按 https://github.com/BurntRoses/handoffglass/blob/main/docs/INSTALL_AGENT.md 在我的本机 Codex 安装 HandoffGlass 原生插件，检查安装是否成功，并告诉我怎么在新聊天里确认连接。
```

插件在本机运行。装好后，新开一个聊天加载工具。也可以查看 [Codex 手动安装步骤](docs/CODEX_PLUGIN.md)或[其他 Agent 的接入方式](docs/HARNESS_PLUGINS.md)。

## 主要功能

- **即时标注** 只需指出一个位置时，Agent 可以直接画一个标记，你可以照常操作原应用。
- **操作后接续** 点击「我已完成」，Agent 可以回到原应用核对结果，再给出下一步。点「我没有找到」，Agent 可以重新查看界面并更新标记。
- **自适应配色** 有背景颜色可用时，标记会选择对比更强的颜色，深浅双描边也能让轮廓更清楚。

**示例指令**

> 在当前应用里找到「每日提醒」，用 HandoffGlass 圈出开关。我打开后，请检查它是否已开启。

## 开发环境与反馈

主要开发和测试环境为 Apple 芯片 Mac 上的 Codex。欢迎提交在 Windows 或其他 Agent 环境中的使用反馈。

通过 [Issues](https://github.com/BurntRoses/handoffglass/issues) 报告问题或提出建议，也欢迎提交 [Pull Request](https://github.com/BurntRoses/handoffglass/pulls)。报告问题时，请注明操作系统、Agent 和复现步骤。

[使用文档](docs/INDEX.md) · [构建与升级](docs/COMMUNITY_RELEASE.md)

## 许可

HandoffGlass 采用 [PolyForm Noncommercial 1.0.0](LICENSE)。可以按许可证免费进行非商业使用、修改和再分发。再分发须保留许可证及版权声明。商业使用需要权利人另行许可。
