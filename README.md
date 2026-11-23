<div align="center">

<img src="assets/brandmark.svg" alt="HandoffGlass" width="76" height="76" />

# HandoffGlass

**Your agent can show you where to click.**

[**English**](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md)

</div>

When a task needs your input, HandoffGlass lets your agent circle the exact button or point to it on your desktop. You make the decision and click. The agent can check what happened and continue with the next step.

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

## What it does

- **Marks the actual control.** Use a circle, an arrow, or a spotlight directly over the button, menu, or field you need.
- **Keeps marks visible.** When background colors are available, HandoffGlass picks a contrasting color. Light and dark outlines keep marks legible on busy screens.
- **Guides you one step at a time.** The agent can wait while you act and check the result before moving on. You can pause and come back to the same chat.
- **Locates a control from a screenshot.** On macOS 14 or later, you can confirm sharing one screenshot of a specific app on one display. The agent can use it to mark the same spot on your desktop. This requires macOS screen recording permission and an app that allows capture.

<img src="assets/interaction-flow.svg" alt="The agent marks a button, you decide and click, and the agent continues" width="100%" />

Try saying: “Use HandoffGlass to show me where to open Settings in this app. Wait for me to click before giving me the next step.”

## Compatibility

HandoffGlass is a preview for local macOS and Windows agents. Codex plugin installation and tool discovery have been tested. The complete workflow in which a model guides a person, verifies their action, and resumes is still awaiting real-task validation. See [what has been verified](docs/HOST_EVIDENCE.md).

[Documentation](docs/INDEX.md) · [Builds and upgrades](docs/COMMUNITY_RELEASE.md) · [License](LICENSE)

Source available. Free for noncommercial use. [Commercial use requires separate permission.](LICENSING.md)
