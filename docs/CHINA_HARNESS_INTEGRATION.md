# 中国 Agent / Harness 适配

The **harness** is the integration boundary, not the model name. A model served through DeepSeek API, 豆包/火山方舟 or Kimi does **not** by itself make a desktop app expose external tools.

| Surface | Integration | Status | Source |
| --- | --- | --- | --- |
| DeepSeek Harness developer preview | Cordis native tool plugin + MCP fallback | Plugin source and loader generator; full DSH launch not yet tested | https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/tool.md |
| Tencent WorkBuddy | MCP + Skill connector | Locally generated and schema-shaped; Marketplace submission not performed | https://open.workbuddy.cn/docs/connector |
| TRAE | local stdio MCP | Config generator and validation; no physical GUI acceptance | https://docs.trae.cn/ide_model-context-protocol |
| 火山方舟/豆包模型 | via a capable host (TRAE, custom MCP agent) | Model agnostic, not an app-specific connector | https://developer.volcengine.com/ |
| 豆包主 App | none verified | **Unsupported**; do not silently hijack the app's UI | verify official SDK first |

## WorkBuddy local MCP + Skill

```sh
node scripts/build-workbuddy.mjs
```

The generated `dist/workbuddy-local/` contains exactly one stdio MCP server, `connector-meta.json`, `icon.svg` and Skill. The generated `mcp.json` uses the **current absolute local path** and is **not a portable Marketplace listing**. Do not submit this generated file until the package has been published or an installer resolves the machine-local path. The official connector specification prohibits mixing MCP and CLI in a single connector; we deliberately use **MCP only**, while ordinary shell scripts remain developer tooling.

## DeepSeek Harness native Cordis adapter

In a cloned DSH monorepo (developer preview):

```sh
node scripts/prepare-deepseek.mjs /absolute/path/to/deepseek-harness
cd /absolute/path/to/deepseek-harness
pnpm dsh web --patch ./scratch-handoffglass/cordis.yml
```

Requires Node.js 22 for the local HandoffGlass core. `prepare-deepseek` generates a Cordis plugin **inside the DSH source tree**, using official `ctx.tools.register(defineTool(...))`, so package resolution follows the host. The generated plugin delegates to the same Broker. It registers only three model-facing tools (guide, check, bounded wait) to minimize prompt/schema size. It does not inspect DSH chat logs or modify DSH native session memory. Runtime acceptance against a real DSH checkout is still needed.

## Tool economy and local-first design

Default MCP keeps the eight existing tools. Optional `HANDOFFGLASS_EXTRAS=1` adds two read-only utilities: `handoff_context` (only local user-managed visual preferences) and `handoff_blueprint` (deterministic copy/plans). Both avoid screen content collection and avoid model calls. **No silent model memory writes**. Plugin returns bounded handoff state and `verified:false` until the harness separately verifies the external app.

## Non-local harness

Cloud hosted WorkBuddy/TraeWork or remote VS Code/Codex requires the agent to execute locally beside the user's GUI, or an explicitly approved authenticated relay. This release does not implement such a relay. Failing closed is better than painting on the wrong machine.

The optional model-visible toolset is covered by `npm run test:extras` in the Windows/macOS/Ubuntu CI matrix. The default toolset remains unchanged.
