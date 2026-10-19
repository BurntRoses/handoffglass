<div align="center">

<img src="assets/brandmark.svg" alt="HandoffGlass" width="76" height="76" />

# HandoffGlass

**The handoff, made visible.**

A local interaction layer for AI agents. Show the next step on the desktop, hand control to a person, and return to the task.

[**English**](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md)

<img src="assets/hero.svg" alt="HandoffGlass desktop guidance" width="100%" />

[Get started](#get-started) · [Integrations](#integrations) · [Visual system](#visual-system) · [Documentation](#documentation)

</div>

## A natural handoff between agent and human

Agents handle the workflow. HandoffGlass makes the moment that needs a person visible: an accurate highlight, a clear choice, and a result the agent can use to continue.

<img src="assets/interaction-flow.svg" alt="HandoffGlass interaction flow" width="100%" />

| Show | Decide | Continue |
|---|---|---|
| Arrows, spotlight, rings, hand-drawn guidance | Complete, decline, cancel | Target tracking, events, task verification |

One local Broker serves multiple agents. The Control Center brings together MCP connections, appearance, native UI targeting and diagnostics.

## Get started

**Node.js 22+** · **macOS / Windows**

```bash
git clone https://github.com/BurntRoses/handoffglass.git
cd handoffglass
npm ci
npm run verify
npm run configure
```

`npm run desktop:demo` opens the desktop UI. `npm run gallery` showcases the visual language.

**Continuing the project with Codex?** Give Codex the [local takeover guide](docs/CODEX_HANDOFF.md); it handles GitHub retrieval, setup, real desktop testing, fixes and pull requests.

## Integrations

`Codex` · `Claude` · `Cursor` · `VS Code` · `Gemini CLI` · `Trae` · `Cline` · `Windsurf` · `OpenCode` · `Zed`

[DeepSeek Harness plugin](integrations/deepseek-harness/) · [WorkBuddy connector](integrations/workbuddy/) · [Integration matrix](docs/COMPATIBILITY.md)

## Visual system

Six scene templates and seven SVG primitives, with layered overlays, native target following and polished motion. The desktop and preview gallery share the same renderer.

```bash
npm run gallery
npm run scene:templates
npm run preferences -- set visualStyle=handdrawn
```

## Documentation

[Codex takeover](docs/CODEX_HANDOFF.md) · [Architecture](docs/ARCHITECTURE.md) · [Control Center](docs/CONTROL_CENTER.md) · [Scene protocol](docs/SCENE_PROTOCOL.md) · [Visual language](docs/VISUAL_LANGUAGE.md) · [All docs](docs/INDEX.md)

<sub>Private development repository · v0.15 · UNLICENSED</sub>
