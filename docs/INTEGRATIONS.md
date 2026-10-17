# Connect HandoffGlass to an Agent

HandoffGlass exposes a **local MCP server**. Skills provide prompt guidance but do not install tool access by themselves. Compatible hosts start the MCP server using Node.js.

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

Paste the printed `[mcp_servers.handoffglass]` fragment into your existing `~/.codex/config.toml` (merge, do not replace). Confirm your Codex version supports MCP and restart it. See `examples/codex.toml` for a template.

## Agent Skill

Copy `skills/visual-handoff/SKILL.md` into your host's supported Skill directory, then enable it according to that host's instructions. The Skill prompts the Agent to ask for human review only when needed, to use screen coordinates only when grounded and to verify results independently after a completed human report.

## Smoke tests

```bash
npm run verify
npm run test:integration      # real SDK handshake, isolated headless broker
npm run broker:status         # prints status of your normal local shared broker
npm run desktop:demo          # desktop window test, on macOS or Windows graphical session
```

Multiple MCP hosts may run simultaneously. Their sessions share one local Broker and each host has separate ownership. A `busy` result means another Agent is already guiding the user; it is not an invitation to overwrite the handoff. `npm run broker:stop` stops the persistent Broker when it is no longer needed.

## Troubleshooting

- **MCP connects, UI missing:** the host may be on a remote/cloud machine, but Electron needs the **user's actual interactive desktop**. HandoffGlass v0.3 is a local-only renderer, not a cloud remote-browser plugin.
- **No Electron:** run `npm ci` and ensure GUI display server/desktop session is available.
- **Control target outside screens:** query `screen_displays` and use global DIP coordinates, not screenshot pixels.
- **Permission dialog not visible:** ordinary windows cannot guarantee overlay coverage of UAC secure desktop or other protected surfaces. Use a coordinate-free handoff panel where possible.
- **Busy:** ask the original Agent to end its handoff or let it expire; no other Agent should dismiss it silently.
