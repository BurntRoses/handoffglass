# Install HandoffGlass for the current agent

Use this procedure when the user asks to install this repository. The request is enough: choose the installation method and connect the current agent yourself. Do not ask the user to name an MCP server, select a branch, copy configuration, or plan the workflow. Do not start a demo or a task such as emptying Trash unless requested.

## Install

1. Identify the current agent host and the machine with the user's desktop. Desktop guidance supports local macOS and Windows sessions. A cloud-only host cannot guide a different machine's screen through this local service. Do not claim it is connected in that case.
2. Use the default `main` branch of `https://github.com/BurntRoses/handoffglass`. Reuse an existing installation after verifying its origin; update only with a clean working tree and a fast-forward. Preserve local changes. For a new installation, clone into a persistent per-user application directory, not a temporary checkout. The MCP configuration references this directory, so keep it after installation. Use existing GitHub authentication for this private repository; if access is unavailable, report the necessary sign-in step without requesting a token in chat.
3. Check Node.js 22+ and npm. Reuse an existing suitable runtime, or install a maintained Node.js release into the user's application directory using the available package manager or official distribution. Keep the Node executable available at a stable absolute path. Do not replace an unrelated system runtime.
4. In the repository, run:

   ```bash
   npm ci --include=optional --no-audit --no-fund
   npm run doctor
   ```

   Desktop guidance needs Electron. An MCP-only installation with optional dependencies omitted is incomplete. If a dependency download fails, resolve that failure before reporting installation success. On macOS, build the native helper with `npm run native:macos` when Xcode command-line tools are available. Without the helper, native inspection needs the Swift runtime; host observation can also ground guidance. Do not silently enable Accessibility consent or alter the user's appearance preferences.

## Connect the current host

### Codex

Run from the persistent installation:

```bash
node scripts/install-host.mjs codex --compact --apply
```

This merges the HandoffGlass MCP entry into `$CODEX_HOME/config.toml` (default `~/.codex/config.toml`) and installs the implicitly discoverable `visual-handoff` skill under `~/.agents/skills/`. Other settings are preserved and changed files are backed up. It uses the running Node executable and repository's absolute path.

For an upgrade, inspect the existing HandoffGlass entry and skill first. Add `--replace` only when updating this project's existing integration; preserve deliberate customizations. If the installer rejects an unusual TOML layout, inspect and merge only the HandoffGlass table while preserving unrelated values, then install the same bundled skill. Do not replace the entire configuration.

### Other local MCP hosts

For `cursor`, `cline`, `windsurf`, `gemini`, `copilot`, `zed`, `vscode`, or Claude Desktop (`claude`), use the same installer with that host ID. For VS Code, supply `--workspace` with the user's intended workspace; do not configure this repository by accident.

For a host without an automatic merger, use `node scripts/configure.mjs <host> --compact` and merge its HandoffGlass entry into that host's documented configuration yourself. `claude` in the installer means Claude Desktop; Claude Code uses its own supported MCP configuration. See [host details](INTEGRATIONS.md) and [compatibility](COMPATIBILITY.md) when needed. Do not guess configuration locations or overwrite unrelated servers.

Also install [the bundled skill](../skills/visual-handoff/SKILL.md) into the host's documented, implicitly discoverable skill directory. If the host uses persistent rules instead of skills, store the equivalent HandoffGlass workflow in its supported user-level rule mechanism without replacing other rules. If neither is supported, rely on MCP initialization instructions and disclose that limitation. Do not make the user repeat an orchestration prompt for every task.

## Automatic use

Keep both layers: MCP tools provide the capability; initialization instructions and the bundled skill provide the invocation policy. Do not enable optional extra tools unless needed.

- When asked to teach a desktop task, guide the user through the actions yourself.
- During Computer Use, hand over a step when the user needs to act, log in, authorize, or handle a blocked interaction. Continue ordinary authorized automation where appropriate.
- Observe the current app, request one action with `session_start`, wait with `session_wait`, then inspect the original app before continuing. Ground marks in fresh UI evidence; omit marks if the target is unseen. A user's completion report is not proof of the outcome.
- Keep each on-screen instruction brief and in the user's language. The user supplies the goal; the agent chooses the tools and steps.

The installed skill contains the full workflow. Do not paste it into the user's installation prompt or completion message.

## Verify and finish

Run `npm run connection:check` for an isolated MCP initialization and tool-discovery check. Confirm that the generated host configuration points to the persistent Node executable and MCP entry, and that the skill is installed. No demo, overlay, or real file deletion is part of installation.

Reload tools through the host's supported mechanism when available. Otherwise tell the user to restart the host once; for an older running HandoffGlass instance, also request its restart. Do not kill a Broker holding another agent's session.

An isolated check proves the service starts; it does not prove the current host has loaded it or that a model will choose it. After a host reload, use an available read-only HandoffGlass tool to confirm the connection. If that must wait for restart, say so.

Finish with a brief status and only a necessary user action, for example: “已安装。重启 Codex 后生效。” Report an unresolved failure plainly instead of claiming success. Leave logs, paths, configuration and troubleshooting details in the project unless requested.

For removal or a temporary pause, use the [shared lifecycle workflow](INTEGRATION_LIFECYCLE.md). Do not edit user memory or delete a same-named MCP entry without an installation record.
