# Community builds and release checks

The plugin bundles the local drawing runtime. For installation and platform details, see [host setup](HARNESS_PLUGINS.md) and the [release status](release-status.json).

## Check a plugin build

```sh
npm run test:preacceptance
npm run release:check:plugin
```

The preacceptance suite covers source checks, unit tests and isolated MCP integration. Run `npm run test:release-ui` and `npm run test:plugin-runtime` for graphical checks in Electron. Use `npm run release:check:plugin -- --public` to check the release criteria. Record host results using the [acceptance procedure](HOST_EVIDENCE.md#开始实机验收).

## Platforms and host setup

- Source setup requires Git, npm and Node.js 22+ on macOS or Windows. Managed plugins include a runtime for the current platform and architecture. Keep the checkout at its configured path when using a standalone MCP connection.
- CI builds unsigned previews for macOS Apple silicon, macOS Intel and Windows x64. Downloads come from successful workflow runs.
- The [host setup guide](HARNESS_PLUGINS.md) covers Codex, Claude Code, DeepSeek Harness, WorkBuddy, Cursor, Trae and OpenCode. Generate and import the WorkBuddy connector on the machine that will run it.

## Build a preview

Build from a clean checkout with Node.js 22.12+ and the pinned dependencies in the lockfile.

```sh
npm ci --include=optional --no-audit --no-fund
npm run doctor -- --desktop
npm run handoff:check
npm run test:integration
npm run test:extras
npm run test:legacy
npm run connection:check
npm run release:check -- --preview
# macOS only; run on each architecture being built:
npm run native:macos
npm run dist:desktop
node scripts/verify-package.mjs
npm run test:packaged
npm run verify:dist
```

If `doctor --desktop` reports `electron_runtime_missing`, install the pinned Electron runtime with `node node_modules/electron/install.js` and run the check again.

The default output is `dist/desktop-<platform>-<arch>/`. To build in an empty custom directory, set `HANDOFFGLASS_DIST_DIR` for the build and each package check. Run native runtime checks on the target platform and architecture.

CI uploads the `release/` subdirectory, which contains the downloads, `SHA256SUMS.txt` and `release-manifest.json`. macOS ZIP names identify the architecture. Windows names identify the `setup` and `portable` variants.

Package verification checks download hashes against the build receipt and checks the packaged runtime, source commit, target architecture, native helpers and license notices. Use the manifest and CI run to trace a download to its source commit.

Packaging generates notices for the shipped dependencies and Electron/Chromium. Downloads include the project [LICENSE](../LICENSE), [NOTICE](../NOTICE) and [third-party notices](LICENSING.md).

## Install, upgrade and roll back

For source installation, use the [Agent installation guide](INSTALL_AGENT.md) to install the MCP service and desktop runtime.

On macOS, extract the preview ZIP into an application directory. On Windows, choose the installer or portable executable. Keep the app at the path used to connect the host. Follow your device’s security policy when opening an unsigned build.

Finish or cancel active guidance and quit the app before replacing it. For source updates, record the current commit, check the working tree and origin, fast-forward, run `npm ci --omit=dev --include=optional` and rerun the preflight. To update a managed plugin, rerun its install command. For standalone Codex MCP, apply `--replace` to an unchanged managed entry. For WorkBuddy, generate a new bundle and import it again. Reload the host and confirm the connection with a read-only tool call.

To roll back, restore the recorded source commit while preserving local changes and reinstall its dependencies. For a packaged installation, restore the previous app at the same path. Reload the host.

## Pause and remove

[Pause or remove connections](INTEGRATION_LIFECYCLE.md) through the app, agent or CLI. Remove connections before deleting the installation directory. Remove imported WorkBuddy connectors inside WorkBuddy.

Connection cleanup preserves preferences. Full removal is available through the app, `integration_uninstall`, or `npm run uninstall:app -- --apply`. After the relevant process exits, the worker removes verified application files, managed integrations and runtime data. Read `resultPath` for the final result and the list of retained files.

## Check a public build

macOS distribution uses [Developer ID signing and notarization](https://developer.apple.com/developer-id/). For Windows, choose a signing certificate or service. See [Microsoft Artifact Signing](https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart) for enrollment and eligibility.

```sh
npm run release:check -- --public
```

The check reads the recorded distribution permission, signing status, Windows desktop results, physical multi-display results and Codex/WorkBuddy task results. See the [release status](release-status.json) and [host records](host-evidence.json).
