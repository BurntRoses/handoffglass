# First run & installation

The desktop app opens a local three-step setup on first launch: **connect an agent → choose visual preferences → finish**. The same dialog can be reopened from the tray menu **Setup & Agent connections…**.

The setup is part of the packaged Electron application. It is not a hosted page. All UI and branding are loaded from bundled files; no screenshots or user files are uploaded. The setup renderer uses a dedicated, sandboxed preload and only exposes four narrow operations: inspect local setup status, save validated preferences, copy a host-specific MCP configuration, and open the macOS accessibility preferences pane. A close action is also exposed. Only events originating from that exact setup window may reach the setup handlers.

## Source installation

```sh
npm ci
npm run verify
npm run readiness -- --json
npm run desktop:demo  # real Windows/macOS graphical session required
```

Install desktop support with normal `npm ci` (Electron is an optional project dependency). Headless CI may use `npm ci --omit=optional`.

## Desktop engineering builds

```sh
npm run build:icons
npm run native:macos # macOS only
npm run dist:desktop
```

`build:icons` is invoked by `dist:desktop` automatically and uses no raster package or network connection. It produces matching branded PNG, ICO and ICNS files. The builder bundles the first-run assets together with the desktop UI and the local Broker. Unsigned builds are engineering previews; signing and real desktop acceptance remain separate work.

## Connect an agent

Pick a host from the setup window and copy its generated MCP configuration. The host configuration is **not** silently edited. The packaged configuration uses the installed Electron binary in Node mode; moving a portable application invalidates an absolute path saved earlier. Source-mode configuration uses your existing Node.js 22+ installation.

Different hosts require different configuration structures. The setup uses the same `hostConfig()` function as the CLI generator, including TOML for Codex, `servers` for VS Code, `context_servers` for Zed, and OpenCode's local-command array.

## Privacy defaults

Read-only UI element lookup is off unless the user explicitly enables it. Choosing a style, motion level, language and density creates a private local preferences file; it does not collect account names, passwords, screenshots, previous actions, or the contents of accessible controls. macOS system-level Accessibility permission remains independently controlled by the operating system.

## Verification boundary

The project CI checks packaging structure and packaged MCP stdio handshake. UI quality on actual Windows/macOS desktops, focus transfer, input passthrough, multi-monitor behavior, and OS-protected prompts must still be tested on physical graphical sessions. See [desktop QA](DESKTOP_QA.md).
