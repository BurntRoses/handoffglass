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

Default MCP exposes 15 tools for observation, continuous sessions, connection state and managed integration cleanup. Optional `HANDOFFGLASS_EXTRAS=1` adds three deterministic local utilities: `handoff_context` (user-managed visual preferences), `handoff_blueprint` (copy/plans) and `handoff_assess` (policy-based next-step advice). These utilities do not collect screen content or call a model. Legacy aliases require `HANDOFFGLASS_LEGACY_TOOLS=1`; the default catalog does not include them. **No silent model memory writes**. The experimental Cordis adapter retains its separate three-tool, single-step interface; use the MCP path for continuous sessions and lifecycle management. Both paths require the harness to verify the original application independently.

## Non-local harness

Cloud hosted WorkBuddy/TraeWork or remote VS Code/Codex requires the agent to execute locally beside the user's GUI, or an explicitly approved authenticated relay. This release does not implement such a relay. Failing closed is better than painting on the wrong machine.

The Windows/macOS/Ubuntu CI matrix checks the default, extras and legacy catalogs with `test:integration`, `test:extras` and `test:legacy`. See [compatibility and evidence](COMPATIBILITY.md) for the difference between an MCP SDK check and a real host task.
