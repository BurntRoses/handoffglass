---
name: handoffglass-setup
description: Check a newly installed HandoffGlass Codex plugin, explain any remaining hook trust or desktop permission, and run the first local connection check.
---

# HandoffGlass setup

Call the plugin's `connection_status` once. Drawing needs no HandoffGlass Accessibility access. Call `permission_status` only when the user is setting up optional native control lookup. These report facts; installation alone does not prove the desktop or hooks work. Do not install a second user-level MCP entry or duplicate Skill: this plugin already bundles them.

New installs use MCP + Skills without hooks. If optional lifecycle hooks are present and need trust, point the user to **Settings → Hooks → Review hooks** (CLI: `/hooks`). Codex requires trust for the exact installed scripts; never edit its trust records. A new chat may be needed to load the installed plugin. Do not restart the user's app yourself.

For a trial, ask the user to give an ordinary task such as “用 HandoffGlass 教我打开一个应用的设置”. Follow the bundled visual-handoff Skill. Reuse an authorized host observation and pass bounds/frame directly to drawing, keep the same session, wait for meaningful changes and independently verify the original app. No automatic clicks or approvals.

Hooks synchronize honest phases and provide one bounded continuation reminder. They cannot wake an idle model. Do not claim the full future event-driven step runtime is already implemented.

If the user asks to remove this plugin, call `integration_cleanup` for `host:"codex"`: preview, then `confirm:true` when the user already requested removal. This shared service uses Codex's native removal and cleans receipt-owned local bundle files and private hook bindings. The project's `plugin:codex:remove` command uses it too. Removing the plugin preserves unrelated Codex settings and other plugins. Use `integration_uninstall` only if the user asks to remove the whole HandoffGlass application.
