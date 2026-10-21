# Connect HandoffGlass to an Agent

Ask your agent: `Please install https://github.com/BurntRoses/handoffglass`. It follows the [installation requirements](INSTALL_AGENT.md), connects its own host and installs the guidance rules. The sections below are for manual configuration and troubleshooting.

HandoffGlass exposes a **local MCP server**. Skills provide invocation guidance; compatible hosts start the server using Node.js.

## Print the configuration for your machine

From the repository root:

```bash
npm ci
node scripts/configure.mjs all
# or use `claude` or `codex` instead of `all`
```

The generator uses the absolute path to your **current Node.js executable** and the actual repository path, escaping spaces and Windows backslashes. It only prints text. It will never overwrite your existing host settings.

## Claude Desktop and other JSON MCP hosts

Merge the `mcpServers.handoffglass` member into your existing JSON config. Do **not** overwrite other MCP server configurations. Restart the host to load the new server. See `examples/mcp.json` for the portable template.

## Codex

Run `node scripts/install-host.mjs codex --compact --apply` to merge the MCP entry and install the implicitly discoverable guidance skill. It honors `CODEX_HOME` and preserves other settings. Inspect an existing integration before using `--replace` to upgrade it. Restart Codex to load the tools and skill. See [Codex usage](USE_WITH_CODEX.zh-CN.md).

## Agent Skill

Codex's installer includes the skill. For other hosts, copy `skills/visual-handoff/SKILL.md` into the host's supported implicitly discoverable Skill directory, or use its supported persistent rules mechanism. MCP initialization also supplies the shared workflow. The agent chooses when to guide, grounds screen marks in fresh evidence and verifies the original app after a user's completion report.

## Smoke tests

```bash
npm run verify
npm run test:integration      # real SDK handshake, isolated headless broker
npm run broker:status         # prints status of your normal local shared broker
npm run desktop:demo          # desktop window test, on macOS or Windows graphical session
```

Multiple MCP hosts may run simultaneously. Their sessions share one local Broker and each host has separate ownership. A `busy` result means another Agent is already guiding the user; it is not an invitation to overwrite the handoff. `npm run broker:stop` stops the persistent Broker when it is no longer needed.

## Troubleshooting

- **MCP connects, UI missing:** the host may be on a remote/cloud machine, but Electron needs the **user's actual interactive desktop**. HandoffGlass runs locally.
- **No Electron:** run `npm ci` and ensure GUI display server/desktop session is available.
- **Control target outside screens:** query `screen_displays` and use global DIP coordinates, not screenshot pixels.
- **Permission dialog not visible:** ordinary windows cannot guarantee overlay coverage of UAC secure desktop or other protected surfaces. Use a coordinate-free handoff panel where possible.
- **Busy:** ask the original Agent to end its handoff or let it expire; no other Agent should dismiss it silently.

## Pause or remove a connection

Use the app Connections page or the shared lifecycle tools and CLI. Removal is receipt-based and preserves user edits. WorkBuddy host removal is a separate user action. See [lifecycle](INTEGRATION_LIFECYCLE.md).
