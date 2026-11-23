<div align="center">

<img src="assets/brandmark.svg" alt="HandoffGlass" width="76" height="76" />

# HandoffGlass

**On-screen annotations and guidance for agents**

[**English**](README.md) · [简体中文](README.zh-CN.md)

</div>

Once your agent finds a control with Computer Use, it can call HandoffGlass to circle a button, point to a menu, or highlight a field in the app you’re using. When it needs you to take an action, a card beside the mark shows the next step.

![HandoffGlass outlines the Daily reminder switch and shows the confirmation card](assets/desktop-guidance-en.png)

*In a sample app, the agent circles the Daily reminder switch and asks you to turn it on.*

## Install in Codex · 一句话安装

Copy this into a chat with your local Codex agent:

```text
Install HandoffGlass as a native plugin in my local Codex. Follow https://github.com/BurntRoses/handoffglass/blob/main/docs/INSTALL_AGENT.md, check the installation, and tell me how to verify the connection in a new chat.
```

也可以直接发给本机 Codex：

```text
请按 https://github.com/BurntRoses/handoffglass/blob/main/docs/INSTALL_AGENT.md 在我的本机 Codex 安装 HandoffGlass 原生插件，检查安装是否成功，并告诉我怎么在新聊天里确认连接。
```

The plugin runs on your desktop. You can open a new chat after installation to load its tools. See the [Codex setup guide](docs/CODEX_PLUGIN.md) for manual installation or [other supported hosts](docs/HARNESS_PLUGINS.md).

## Features

- **Quick annotations** When a mark is enough, the agent can draw it while you keep using the app.
- **Follow-through** Select “I completed this” so the agent can check the result in the app and continue. Select “I couldn’t find it” so it can look again and update the mark.
- **Adaptive colors** HandoffGlass uses available background colors to choose a contrasting mark. Light and dark outlines keep its edges clear.

**Example prompt**

> Find Daily reminder in the current app and use HandoffGlass to circle the switch. After I turn it on, check that it’s enabled.

## Development and feedback

HandoffGlass is primarily developed and tested with Codex on Apple silicon Macs. Feedback from Windows and other agent environments is welcome.

Report bugs and request features through [Issues](https://github.com/BurntRoses/handoffglass/issues). When reporting a bug, include the operating system, agent, and steps to reproduce it. Contributions are welcome via [pull requests](https://github.com/BurntRoses/handoffglass/pulls).

[Documentation](docs/INDEX.md) · [Builds and upgrades](docs/COMMUNITY_RELEASE.md)

## License

HandoffGlass uses [PolyForm Noncommercial 1.0.0](LICENSE). Noncommercial use, modification, and redistribution are free under the license. Redistribution requires retaining the license and copyright notice. Commercial use requires separate permission from the rights holders.
