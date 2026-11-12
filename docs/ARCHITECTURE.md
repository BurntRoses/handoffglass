# Architecture

HandoffGlass is an **on-device interaction runtime**, not an independent task-planning agent. It turns an Agent's grounded instruction into desktop visual guidance or a human decision, then returns a bounded, owner-scoped result.

## Runtime topology

```text
MCP clients (Codex, Claude, Trae, WorkBuddy, …)
  └─ stdio src/mcp.mjs  [one process and ephemeral owner ID per client; scoped recovery token]
       └─ src/runtime.mjs  [private discovery manifest / single-start lock]
            └─ 127.0.0.1:<random port> + agent bearer
                 └─ src/broker.mjs  [single long-lived Broker]
                      ├─ src/core.mjs  [HandoffManager: one active session]
                      ├─ src/local/interaction-journal.mjs  [bounded ephemeral event cursor]
                      ├─ src/native/anchor-tracker.mjs  [opt-in local target recheck]
                      └─ src/bridge.mjs  [credential- and route-separated IPC]
                           └─ desktop bearer → src/desktop/main.mjs
                                ├─ click-through overlay per display
                                ├─ separate clickable human decision panel
                                ├─ first-run setup / Control Center
                                └─ macOS AX / Windows UIA read-only locator
```

When the installed Electron GUI is the launcher, `src/desktop/app.mjs` hosts the Broker; when MCP clients launch the source project, `src/runtime.mjs` starts one Broker as needed. These paths must converge on one runtime session, never parallel state stores. Desktop windows use isolated renderers, scoped preload APIs and local resources. The preview in `site/` is not a native UI test.

## Ownership and lifecycle

`HandoffManager` is authoritative. Continuous tools keep one session ID and screen owner through:

```text
awaiting_user (waiting_user / presenting)
  → user_action_reported (verifying)
  → observing (next_step)
  → awaiting_user (next step)
  → completed, declined, cancelled, expired or superseded
```

A completion button is a user report. The Agent checks the original app and calls `session_verify`; `result:"verified", finish:true` ends a continuous workflow. Each verified next step uses `session_present(sessionId, …)` with a separate step deadline inside a fixed task deadline. A failed check or explicit recovery re-presents the same step. Sensitive confirmation deadlines remain bounded even while paused. A new request by the same owner can supersede; another owner sees `busy`. `requestId` deduplicates retries within an owner and step. A new MCP process can reclaim only with `session_resume(sessionId, resumeToken)`; the token rotates, old ownership is revoked, and marks are cleared pending fresh observation. Legacy `handoff_request` retains the one-step completion contract.

The in-memory journal retains bounded cursor events. `session_wait` immediately returns available meaningful events, otherwise waits for journal changes; it does not wait for a terminal session first. Consecutive target movements are coalesced and do not independently wake an Agent waiter. Timeout/disconnect removes listeners. `truncated:true` reports dropped history. Restarting the Broker discards events, but a private minimal checkpoint can restore the workflow into reobservation. The checkpoint stores ownership hash, step and deadlines, never task text, control names, coordinates or raw recovery tokens.

The desktop receives authenticated SSE snapshots over `/desktop/stream`, with a bounded connection count, heartbeat and slow-reader limit. Reconnection starts from the current snapshot. The old `/poll` route remains for existing desktop adapters, but the production desktop uses push. Native target following remains local. Persistent JSON-line helpers reuse native references scoped to the same process/window; platform change notifications request fresh evidence and polling remains the fallback. Status-only permission queries read no controls.

User preferences persist locally. `integration_set_enabled` changes only the global switch on a user request; disabling immediately cancels active guidance and clears tracking. Accessibility consent remains an app-only user choice, separate from OS permission. See [lifecycle and cleanup](INTEGRATION_LIFECYCLE.md).

## Interfaces

**Full MCP tools (20):** `review_changes`, `screen_mark`, `screen_displays`, `ui_inspect`, `ui_locate`, `capability_manifest`, `session_start`, `session_present`, `session_wait`, `session_update`, `session_verify`, `session_stop`, `connection_status`, `permission_status`, `integration_status`, `integration_cleanup` `integration_set_enabled`, `session_resume`, `session_control` and `integration_uninstall`. Tool results include machine-readable `structuredContent` and a text fallback. Installers enable compact output.

`HANDOFFGLASS_LEGACY_TOOLS=1` adds the seven old one-step/scene aliases for existing clients. They are excluded from the normal tool catalog. `HANDOFFGLASS_EXTRAS=1` adds the three local read-only helpers (`handoff_context`, `handoff_assess`, `handoff_blueprint`). The Codex plugin uses the 18-tool host profile, with native lookup hidden and compact bounds/frame presentation schemas. Standalone full preserves existing interfaces. Initialization includes the core workflow in fewer than 512 characters; `capability_manifest` exposes conditions, inputs, recovery actions and host/transport limits. The installed Skill provides a short routing table without asking the model to reread a manual each step.


The single local Bridge has distinct Agent and desktop tokens, loopback-only socket, Host/Origin checks, bounded JSON, event streams and waits, and per-owner access checks. Only Agent routes accept the agent token; desktop state, event delivery and human decisions require the desktop token. `src/local/host-activity.mjs` exposes recent authenticated calls with **caller-declared** host labels (not verified application identity).

## Coordinates, scenes and rendering

Global coordinates are Electron **device-independent pixels (DIP)**. Displays may have negative origins. On Windows UI Automation, input is physical pixels; `src/native/calibration.mjs` requires matching monitor evidence before conversion. On macOS the native locator reads Accessibility's global logical coordinates. `src/visual/grounding.mjs` validates match provenance, recency and visibility; `src/visual/scene.mjs` owns templates, shapes, layered structure and atomic patches. `src/desktop/overlay-renderer.mjs` is the production SVG renderer; `scripts/build-overlay.mjs` generates the classic renderer for Electron; `npm run gallery` shares the production renderer.

Opaque `targetRef` values are owner-, expiry- and display-layout-scoped; resolving one always refreshes native evidence. Native targets are followed locally (default `followTarget:true`) until the session ends or manual scene editing takes ownership. If native evidence disappears, permission fails or the display layout changes, stale annotations are hidden; none of those transitions verifies the user's action. A scene update uses an `expectedRevision` to prevent stale writes.

## Build, installation and platform boundary

- Headless MCP: Node.js 22+, `npm ci --omit=optional`, `npm run verify`, `npm run test:integration`.
- Native desktop: optional Electron, `scripts/build-icons.mjs`, `scripts/build-native-macos.mjs` (macOS helper), `electron-builder.config.cjs`. CI builds unsigned macOS and Windows preview artifacts and tests packaged MCP stdio.
- macOS AX inspection and Windows UIA inspection require permission and **real-device** verification. Windows UAC secure desktop, cloud-only Agents, managed Wayland desktops and protected app surfaces are not guaranteed targets.
- No signing, notarization, auto-updater, remote desktop tunnel, automatic click or screen recording is part of the current tested release.

## Change map

| Task | Authoritative module | Checks |
|---|---|---|
| Session, ownership, user feedback | `src/core.mjs`, `src/local/interaction-journal.mjs` | `test/core.test.mjs`, `test/interaction-journal.test.mjs` |
| MCP, broker, security | `src/mcp.mjs`, `src/bridge.mjs`, `src/runtime.mjs` | `npm run test:integration`, `test/bridge.test.mjs` |
| AX/UIA, DPI, live tracking | `src/native/`, `native/{macos,windows}/` | `test/anchor-tracker.test.mjs`, `test/calibration.test.mjs`, real `docs/DESKTOP_QA.md` |
| Desktop design and scene patches | `src/desktop/`, `src/visual/` | `npm run gallery`, `npm run scene:lint`, `test/visual-renderer.test.mjs` |
| Host install / configuration | `src/config.mjs`, `src/host-install.mjs`, `integrations/` | `test/config.test.mjs`, `test/connector.test.mjs` |
| Installer | `electron-builder.config.cjs`, `.github/workflows/` | packaged MCP smoke + clean-install desktop acceptance |

See [Codex handoff](CODEX_HANDOFF.md), [security](SECURITY.md), [compatibility](COMPATIBILITY.md) and [desktop acceptance](DESKTOP_QA.md).

## Workbench and owned removal

The desktop workbench separates local service checks from installation-scoped successful host calls. Host labels remain caller-declared; trust and binding are not inferred from file presence. The guide card can collapse into a control strip and displays only reported phases or observed wait/connection state. Pause, resume, re-locate and text fallback are explicit workflow events.

Full uninstall uses the same service from App, CLI and MCP. An installation receipt records app identity and owned files. An external remover waits for HandoffGlass processes to exit, verifies file digests and removes only unchanged owned content; additions and edits are retained and reported. The development repository is never an application removal target. Desktop discovery uses a separate private `desktop.json`, keeping `broker.json` scoped to Agent credentials.

## 设置写入与等待反馈（0.19.2）

控制中心和首次设置向导通过桌面凭据向 `/desktop/preferences` 提交字段 patch，不直接写设置文件。Broker 与 Agent 的启停接口共享进程内的逐目录写入队列；原子替换仍负责文件完整性。独立 CLI 管理命令应在设置窗口关闭后使用；此队列不是跨进程文件锁。控件定位授权只接受桌面凭据，省略该字段不会改变授权。撤销时立即移除跟随标记。

外观草稿与已保存偏好分开：刷新更新实际总开关/权限，同时保留草稿。保存期间的后续编辑仍标为未保存。切换显示器与开关只提交自己的字段。

用户报告在暂停后保留待核实状态，恢复只重新通知核验，不再记录一次用户操作。挂起唤醒当前等待并返回 `yield_to_user`；终态不再进入游标长等待。桌面“挂起”只调整本地执行模式，重新 attach 由回到聊天后的 Agent 发起。状态/等待变化不重绘相同标记、不重建遮罩、不重复设置原生窗口 bounds。

恢复凭证轮换与 Broker 重启保留待核实/用户暂停状态，不保留坐标、任务文字或原始凭证。用户报告的桌面应答等待最小检查点落盘；重连后按 `verify_in_app` 核实既有报告，按 `observe_app` 重观测待操作步骤，按 `wait_for_resume` 尊重用户暂停。所有恢复均清理旧标记并保持未核实，不能把记录视作应用成功。

## Host observation (0.21)

The host supplies authorized screen/DOM/UI evidence; the plugin deterministically converts top-left bounds/frame into DIP and renders without native lookup. Native permission probes are absent from capability discovery. Fixed targets require fresh host evidence after window movement, and display layout changes invalidate them. New Codex installations use Skills + MCP with no command hooks; optional lifecycle hooks exclude drawing and model requests. See [responsibilities, coordinate contract and validation](HOST_OBSERVATION.md).

## Plugin runtime and presentation layers (0.22)

Codex installs a managed runtime snapshot with production dependencies and the platform Electron renderer. The checkout can move after installation. Portable builds use the host root token; the local Codex compatibility installer uses the managed snapshot path because the tested Codex version does not expand that token in its compatibility MCP file. Node remains a required external runtime. Electron is started only when a desktop surface is needed.

A bounded memory-only `PresentationLog` publishes guidance, read-only review and verification projections. Each has an independent preference switch. Reviews store bounded summaries and hashes, redact suspected credentials before entry and again on explicit copy, and execute no actions. High-risk reviews return `await_human_review`; host policy must honor this and any refusal. HandoffGlass cannot freeze the host's unrelated tools. Verification has three outcomes: verified, mismatch, inconclusive. Inconclusive clears geometry and requests independent evidence.

Target evidence is mandatory for bounds/frame. Fixed geometry clears when the observation reaches 30 seconds; local timers do not call a model. Display changes invalidate it earlier. Native wrappers for DeepSeek and OpenCode reuse the MCP catalog and validators, forward cancellation, and isolate owners by host Agent/chat. Claude Code bundles the same stdio entry. [Host evidence](HOST_EVIDENCE.md) distinguishes protocol checks from real model/human tasks.
