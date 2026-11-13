# Community builds and release checks

HandoffGlass is a plugin-first engineering preview. A plugin includes the local drawing runtime and does not require a separately installed App. A passing build proves neither host acceptance nor a signed, supported desktop installer. Platform evidence is recorded in [release-status.json](release-status.json), and individual host tasks in [host-evidence.json](host-evidence.json).

## Prepare the plugin trial

With dependencies installed, run the source and isolated protocol checks in one command:

```sh
npm run test:preacceptance
```

This does not install a host, open the desktop or call a model. It includes syntax/repository checks, unit tests, the full and host MCP profiles, connection checks, extras/legacy compatibility and the plugin preview gate. Graphical regressions are separate: `npm run test:release-ui` and `npm run test:plugin-runtime` open an isolated Electron runtime.

```sh
npm run release:check:plugin
```

The plugin gate reports `delivery:plugin` and `signingRequired:false`. Signing a separate desktop App is not a prerequisite for this route. A supported public plugin release still needs the relevant Windows, physical multi-display and seven-host task evidence; preview checks report those pending items without claiming acceptance. Use `npm run release:check:plugin -- --public` to enforce that gate. See [host setup](HARNESS_PLUGINS.md) and [acceptance steps](HOST_EVIDENCE.md#开始实机验收).

## What is available

- Source setup requires Node.js 22+, npm, Git and local macOS/Windows. Managed plugins copy their own runtime; source-based standalone MCP entries still require their installation directory to remain in place. Each plugin runtime is generated for its platform and architecture.
- CI builds unsigned macOS Apple silicon, macOS Intel and Windows x64 previews. Availability depends on the corresponding workflow passing. Linux desktop, Windows ARM and remote display bridging are not release targets.
- No npm package, WorkBuddy marketplace listing or automatic updater is published by this workflow. A generated WorkBuddy connector contains local executable paths and is only for the machine that generated it.
- Receipt-based install, enable/disable and cleanup cover Codex, Claude Code, DeepSeek Harness, WorkBuddy's local bundle, Cursor, Trae and OpenCode. WorkBuddy's imported connector remains a host-side action. Other generated host templates and manually installed rules require their own removal procedure.

## Build a preview

Use a clean checkout and the lockfile. Desktop builds use the pinned local electron-builder; they do not download a fresh builder with `npx`. The builder is pinned to 26.15.3, including its dependency graph, to replace the older build chain with known archive-extraction vulnerabilities. Build tools require Node.js 22.12+; the runtime-only installation retains Node.js 22+ support. No native Node addons are used by this project.

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

`doctor --desktop` checks the actual executable, not just the npm package. If npm skipped Electron's install script, it reports `electron_runtime_missing`; install the locked runtime with `node node_modules/electron/install.js` before continuing. Do not treat npm's successful exit alone as desktop readiness.

The default output is `dist/desktop-<platform>-<arch>/`. `HANDOFFGLASS_DIST_DIR` can select a separate empty build directory and must be used consistently for the build and every packaged check. Cross compilation is not accepted as native runtime verification.

The `release/` subdirectory contains only downloads, `SHA256SUMS.txt` and `release-manifest.json`. CI uploads this directory, excluding unpacked applications, debug files, local connectors and older downloads. macOS ZIPs include their architecture; Windows files explicitly say `setup` or `portable`. Never publish a local `dist/` directory wholesale.

After the builder emits downloads, a build receipt binds their hashes to the packaged ASAR. Verification checks that receipt before staging. Checks reject missing, mixed-version and mixed-target downloads, a changed/stale packaged runtime, a mismatched source commit or architecture, missing runtime files, native helpers and license notices. Hashing streams large files rather than loading each executable into memory. The manifest records dirty source builds and the pending public release evidence; it is not a digital signature. Review the source commit and public workflow when verifying a download.

Embedded third-party notices cover installed non-optional runtime dependencies and Electron/Chromium. Build-only dependencies are not shipped. `build/notices/` is regenerated from installed dependencies before packaging; missing notices fail the build. HandoffGlass itself uses the [PolyForm Noncommercial License 1.0.0](../LICENSE): free noncommercial use, modification and redistribution; commercial use requires separate permission. It is source-available, not OSI open source. The package includes LICENSE and NOTICE.

## Install, upgrade and roll back

For source installation, follow [Agent installation](INSTALL_AGENT.md). That path omits development dependencies, including the packaging toolchain; it installs only the MCP service and desktop runtime. Check repository access first; if GitHub denies access, installation cannot continue. Do not ask users for tokens in chat.

For an app preview, extract the ZIP into a stable application directory on macOS, or choose the Windows installer/portable executable. Keep the executable in place after connecting a host: MCP entries reference its absolute path. Version 0.18 records a verified desktop application's owned files for the in-app full removal flow. Windows NSIS separately removes installed application files and preserves user data and external host configurations. OS security prompts for unsigned builds remain in force. Do not instruct users to bypass their device's security policy.

There is no automatic update. Finish or cancel active guidance and exit the old application before replacing it. For source updates, record the current commit, verify a clean working tree and the expected origin, fast-forward, run `npm ci --omit=dev --include=optional`, and rerun the local preflight. Keep user modifications. Refresh a managed plugin by rerunning its installation command; the installer checks the prior receipt before replacing its files. For an explicitly chosen standalone Codex MCP, use `--replace` only when its previous managed content is unchanged. Regenerate the WorkBuddy bundle and reimport it in WorkBuddy. Reload the host, then make an actual read-only tool call. Preflight alone does not prove the host loaded the update.

If an upgrade fails, stop before reporting success. Restore the recorded source commit with the user's changes preserved and reinstall its lockfile dependencies, or replace the application with the previous preview at the same stable path. Reload the host. Do not delete the prior installation record to force an upgrade over modified configuration or Skills.

## Pause and remove

[Pause/removal](INTEGRATION_LIFECYCLE.md) is available through the app, natural-language Agent requests and the CLI. Remove managed connections before deleting an installation directory; otherwise hosts will retain commands pointing to missing files. WorkBuddy's imported connector must also be disabled/removed inside WorkBuddy.

Connection cleanup preserves preferences. Full removal is available separately through the app, `integration_uninstall`, or `npm run uninstall:app -- --apply`; it removes verified application files, owned integrations and runtime data after the relevant process exits. Edited and unknown files remain and appear in the result. The external worker reports its final result through `resultPath`; `scheduled:true` is not proof of completion. Development checkouts, host memories, other MCP settings and system Accessibility grants are retained. WorkBuddy's imported connector still needs removal inside WorkBuddy; Windows and physical-device acceptance remain pending.

## Gate a supported public release

Signing is independent of the source license. Unsigned engineering previews and source installations are allowed by this project's release policy. The following gate is our quality requirement for a supported public installer; it is not a claim that source-available or open-source projects legally must buy a certificate.

For macOS distribution outside the App Store, plan for Developer ID signing and notarization. Apple allows individual enrollment as well as organizations; a company is not required. Apple Developer Program membership is USD 99 per year, or the local enrollment price. See [Apple enrollment](https://developer.apple.com/programs/enroll/) and [Developer ID](https://developer.apple.com/developer-id/).

Windows public signing requires a suitable certificate or signing service. Cost and individual eligibility vary by provider and country. Microsoft's Artifact Signing currently accepts individual Public Trust applicants in the US and Canada only; its organization list is broader. It requires a paid Azure subscription, and signing alone does not guarantee that SmartScreen warnings disappear. Verify [current eligibility](https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart), [billing and SmartScreen FAQ](https://learn.microsoft.com/en-us/azure/artifact-signing/faq) and [pricing](https://azure.microsoft.com/en-us/pricing/details/trusted-signing/) before choosing a provider. Do not assume an individual in another country is eligible or quote a price not shown for their plan.

```sh
npm run release:check -- --public
```

This command fails while distribution permission, signing/notarization, Windows desktop acceptance, physical multi-display checks and real Codex/WorkBuddy task acceptance are missing. Each verified item needs a repository acceptance record. Keep the policy pending until the underlying checks have actually passed. A headless MCP SDK test cannot establish trust, enablement, binding or model behavior inside another product.

Repository visibility and release publishing remain owner actions. These checks do not publish a release, change visibility, grant a license or install anything on a user's computer.
