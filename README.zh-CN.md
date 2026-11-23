<div align="center">

<img src="assets/brandmark.svg" alt="HandoffGlass" width="76" height="76" />

# HandoffGlass

**让 Agent 直接在屏幕上指给你看。**

[English](README.md) · [**简体中文**](README.zh-CN.md) · [日本語](README.ja.md)

</div>

遇到需要你亲手操作的步骤，HandoffGlass 让 Agent 在你的桌面上圈出按钮，或画个箭头指给你看。你决定点不点、自己动手。Agent 可以等你操作完，确认结果，再继续任务。

## 一句话安装

把这句话发给本机 Codex：

```text
请按 https://github.com/BurntRoses/handoffglass/blob/main/docs/INSTALL_AGENT.md 在我的本机 Codex 安装 HandoffGlass 原生插件，检查安装是否成功，并告诉我怎么在新聊天里确认连接。
```

插件在本机运行。装好后，新开一个聊天加载工具。也可以查看 [Codex 手动安装步骤](docs/CODEX_PLUGIN.md)或[其他 Agent 的接入方式](docs/HARNESS_PLUGINS.md)。

## 能做什么

- **直接标在原位置。** 按钮、菜单、输入框都可以用圈、箭头或聚光框指出来。
- **标记在复杂背景上也看得清。** 能获取目标周围的颜色时，标记会自动挑选对比更明显的颜色。深浅两层描边也能让轮廓更清楚。
- **一步一步带你做。** 每次只提示当前动作，可以等你点击、核对结果，再给下一步。需要离开时，可以暂停，之后回到原聊天继续。
- **从截图找位置。** 在 macOS 14 及以上，授予屏幕录制权限后，你可以确认分享一张指定应用的截图。Agent 可以据此在桌面原处标出按钮。截图只包含该应用在一块显示器上允许捕获的窗口。

<img src="assets/interaction-flow.svg" alt="Agent 标出按钮，你决定并点击，Agent 继续任务" width="100%" />

装好后可以试一句：「用 HandoffGlass 指给我看这个应用的设置在哪。等我点完，再告诉我下一步。」

## 欢迎一起试试

我平时主要在 Apple 芯片的 Mac 上用 Codex，HandoffGlass 也是在这套环境里边做边试的。Windows 和其他 Agent 我用得少。如果你试了，哪一步顺手、哪一步卡住，都欢迎来 [Issues](https://github.com/BurntRoses/handoffglass/issues) 聊聊。想一起改，也欢迎[提 PR](https://github.com/BurntRoses/handoffglass/pulls)。

[使用文档](docs/INDEX.md) · [构建与升级](docs/COMMUNITY_RELEASE.md) · [许可证](LICENSE)

源码可用，非商业用途免费。[商业用途需另行取得许可。](LICENSING.md)
