## 0.23.0 · 宿主接入与验收准备

- 七宿主共用安装、状态、启停与归属清理；连接页保留失败原因，区分文件写入、工具加载与实际调用。
- DeepSeek / OpenCode 原生入口按绑定会话交付决策事件；挂起不唤醒模型，拒绝、旧步骤和失败交付不自动重试。
- Claude Code 加入独立 marketplace 生命周期及可选 Hooks；Codex 绘制审批与安装状态分开检查，不改宿主审批策略。
- App 安装正确复制 Electron ASAR 资源；DeepSeek 启动命令携带所需环境，并在启动 Harness 前清除 Electron 模式。
- 打包归档不再被当作开发目录扫描；Codex 更新复用已记录的 CLI，支持未加入 PATH 的桌面内置命令。
- 完整卸载先准备外部移除器，运行包在退出后核对摘要删除，保留用户改动。
- 新增 `test:preacceptance` 和插件发布检查；本地插件不以独立 App 签名为前提，真实宿主、Windows 和物理多屏继续单独验收。
- 修复打包 App 缺少插件模板和依赖清单导致的接入失败；App 创建的连接复用已登记的 App，状态页显示依赖，源码插件仍自带渲染器。
- 打包回归覆盖六类 App 关联连接的生成、MCP 加载和归属清理；新增 `test:plugin-runtime:packaged` 验证迁移后实际绘制与清除。公开页面就地标明试用和真实闭环待验状态。

## 0.22.1 · 拒绝与超时

- 普通交接与改动审查都记住本次 Broker 生命周期内的拒绝。更换请求编号、坐标或样式不会重新询问；仅在用户明确要求再试时使用 `retryDeclined:true`。
- 敏感确认仍待处理时，任务、步骤或确认截止均返回拒绝；已报告完成、等待独立核验的会话按核验截止过期。
- `declined_by_user` 与 `respect_refusal` 保留至 MCP 和原生宿主，避免被误报为另一 Agent 占用。

## 0.22.0 · 插件运行时与分层呈现

- Codex 插件携带运行快照、生产依赖和本平台 Electron；安装后不依赖开发目录，默认无命令 Hooks。
- 引导、只读改动审查与核验独立开关；核验采用 verified / mismatch / inconclusive。
- 目标必须携带观察时间、布局签名和来源；固定坐标在观察满 30 秒时清除。
- DeepSeek / OpenCode 原生入口共用 MCP 工具目录，按聊天分配所有权并传播取消；Claude Code 原生包加入构建和按清单清理。宿主真实模型闭环仍待验证。
- 审查窗口提供中英文、主题、哈希折叠和只读步骤记录。前端处方焦点策略使用控件表面、文字和亮度。
- 许可保持 PolyForm Noncommercial；签名 App 和自动更新延后，不作为插件本轮交付前提。
## 0.21.0 · 2026-11-12

- Split host observation from local rendering. Accept top-left bounds and explicit image frames for deterministic pixel-to-DIP mapping; validate recency, display coverage and layout changes.
- Use a 17-tool host profile in Codex, with smaller presentation schemas and optional native lookup in full mode. Remove native permission probes from capability discovery.
- Default new plugins to Skills + MCP without command Hooks. Keep optional lifecycle hooks scoped to sessions, preserve existing mode choices, and remove per-model-request scripts.
- Rewrite bundled routing around one-call drawing from authorized host evidence. Mark native lookup permissions as optional in App and setup; retain verification, ownership and cleanup.
- Preserve a blocked step across display recalibration without advancing or treating it as verified. See [validation](qa/2026-11-12-host-observation.md).

## 0.20.0 · 2026-11-12

- Expand direct screen drawing to all 19 shapes, nine display positions, captions, directional arrows, stroke weight/dashes and numbered compositions of up to eight marks. Compute layout locally in one call.
- Update or clear an owned drawing with its ID and revision. Preserve expiry, reject stale writes and other owners; return only a compact receipt.
- Add screen trial, update and clear actions beside the shared preview. Keep size/caption controls in the prescription's reversible Accordion with keyboard focus return and inert content.
- Preserve primary-display identity in the desktop handshake; use the primary display even when another screen appears first.

## 0.19.2 · 2026-11-12

- Submit changed setting fields through the Broker and serialize writes; independent switches, display choices and appearance no longer restore stale values. Preserve appearance drafts while refreshing real enable/disable state, with inline unsaved/save feedback.
- Preserve an unverified user report and explicit pause through token recovery and Broker restart; flush acknowledged reports before replying to the desktop. Preserve the report through pause/resume. Do not duplicate the user action in the event stream or allow advancing past verification.
- Keep the recorded-action receipt visible, hide the obsolete action text, and give a direct return-to-chat instruction. Only the Agent can attach a parked workflow; the desktop no longer offers a button that suggests waking an idle model.
- Immediately release an attached wait when parked; return completed sessions immediately even after their event cursor has been consumed.
- Skip unchanged overlay frames and native bounds updates when only Agent activity or wait state changes. Revoke target marks immediately when control lookup is disabled.

## 0.19.1 · 2026-11-12

- Simplify guidance headers with named icon controls, compact state copy and distinct waiting/recorded/processing feedback.
- Keep long guidance scrollable inside a bounded card; reset scroll and disclosure on each new step, with persistent error feedback outside the scrolling region.
- Stop hidden panel timers and activity animation; deduplicate size messages and schedule only upcoming countdown/activity changes.
- Remove duplicate disclosure chevrons and render floating card corners over a transparent native surface.

## 0.19.0 · 2026-11-12

- `screen_mark` handles explicit simple drawings in one call, without inspecting the screen or waiting on a workflow.
- Cache live Broker discovery; recover refused stale connections without replaying uncertain mutations. Coalesce desktop snapshots within a microtask and send SSE immediately.
- Attached and parked execution: desktop guidance continues while the chat returns; user actions await independent verification. App and MCP share park/attach actions; Codex hooks leave parked workflows alone.
- Native reversible disclosures adapted from the prescription's shadcn Accordion; shared keyboard/focus/inert/reduced-motion behavior and measured panel resizing.
- Source and packaged desktops share one instance identity; installed app joins a live Broker, and the Broker prefers the recorded final desktop.

## 0.18.0 · 2026-11-04

- Continuous workflows now have separate step/task/confirmation deadlines, explicit pause and recovery, and scoped rotating reconnect tokens with minimal private restart checkpoints.
- Observed-condition guides can complete through independent verification. Native candidate changes remain unverified; sensitive decisions require the user.
- Persistent native helpers and scoped references avoid repeated process startup. Local target following filters/coalesces geometry events.
- Task workbench, target-adjacent adaptive card, collapsible control strip, truthful phase/connection state and local recovery actions.
- Installation-scoped connection checks, centralized status-only permission checks and visible multi-display setup.
- Shared App/CLI/MCP uninstall with owned file receipts, an external remover and retained-file reporting.
- New tools: `session_resume`, `session_control`, `integration_uninstall`. Existing tool names remain available; advancing a step requires verification.

## 0.17.0 · 2026-10-20

- 安装入口缩为一句请求；Agent 在项目内读取安装、配置合并、技能接入与检查要求。
- 首页和安装页移除命令、分支与测试流程，保留安装和日常使用。
- MCP 初始化直接交付引导规则：用户只说任务，Agent 自己选择工具并安排步骤。
- 新增 `ui_inspect`，在授权后查看前台控件；不读取输入值，不截屏、不点击。
- 会话结果保留下一步动作，紧凑输出也能区分等待、重定位、核验和停止。
- 「连接 Codex」合并现有配置并安装可自动选择的引导技能，备份变更，保留其他服务。
- 使用示例改为“教我清空废纸篓”，删除逐步编排工具的长提示词。

## Unreleased — expressive visual guidance

## 0.16.0 · 2026-10-20

- 重做桌面界面、首次设置、操作浮窗和原生菜单，删除宣传文案、常驻配置与重复说明。
- 导航改用 SVG；统一应用图标，修复开发模式 Dock 图标和 macOS 菜单栏模板图标。
- 新安装默认使用极简标注，保留已保存的用户偏好。
- 外观预览复用生产渲染器；定位授权开关即时保存；诊断按需展开。
- 补充真实窗口回归、截图和 Codex 废纸篓引导提示词。


- Reworked production SVG strokes, labels and feathered spotlight masking; added marker ink, corner brackets, check glyph, overlapping pen loops, halo and vector pointer (13 marks / 9 templates).
- Added local draw, flow, pulse and still effects with bounded per-mark delay/duration and staggered sequence templates.
- Preserved drawing progress across snapshot and geometry updates; kept reduced-motion strokes fully visible and opacity intact.
- Rebuilt the shared-renderer visual atelier and added a real MCP/Electron interactive trial, with measured fixture coordinates and downstream state checks.
- Added structural, protocol and real desktop regressions, including new styles through native Accessibility tracking.

## Unreleased — macOS desktop validation

- Fixed Electron ESM startup deadlocks in both desktop entrypoints and GUI launches inherited from Electron's Node mode.
- Fixed packaged MCP-to-GUI attachment and native helper resolution outside ASAR; added a real packaged desktop regression.
- Kept macOS overlays aligned with full display bounds and restored visible annotations after display-window rebuilds.
- Reduced local native-anchor polling to 500 ms after each completed query, without overlapping queries or model calls.
- Preserved actionable native-locator error codes across the Broker/MCP boundary.
- Made diagnostic and Control Center versions follow package metadata.
- Added real Electron startup/window regressions and a measured AppKit Accessibility fixture; recorded macOS evidence and outstanding physical-device QA.

## 0.15.0 — Incremental handoff recovery

- Added an owner-scoped `handoff_events` MCP tool for bounded cursor-based transitions and deterministic recovery guidance.
- Added private Broker-only interaction journal and localized timeline in the desktop settings center.
- Native target loss or display changes now block unsafe scene updates; manual scene edits visibly release auto-follow ownership.
- Added tests for permissions, ownership, cursor bounds, failure transitions, user decisions and expiry.
- No persistent event history, screenshots, hidden automation or model dependency.

## v0.14.0 — Live anchored native UI targets

- Exact foreground Accessibility/UIA targets can now follow window movement locally without new model calls.
- Missing, ambiguous, stale or unmappable targets remove the old visual annotation; the user-controlled handoff remains open.
- Display-layout updates invalidate existing location evidence before the next successful observation.
- Existing guide/handoff deadlines and ownership stay unchanged; manual scene edits stop automatic following.
- `followTarget:false` disables tracking, and `targetTracking.status` reports evidence state (not action success).
- New movement, lost/recovered target, race, template revision and owner-scoped integration regression tests.

## v0.13.0 — on-device host activity and geometry rechecks

- Attribute *observed* authenticated MCP tool calls to the caller-declared host configuration. No host enrollment, identity authentication or persisted task log is implied. Evidence expires after fifteen minutes.
- Show local tool call evidence in Control Center (separate from isolated self-tests), with clear trust labels and no task content.
- Extend `ui_locate` with an optional previous observation for deterministic motion and display-layout comparisons, without new model tools or automatic clicks.
- Reject Windows UIA rectangles crossing monitor/DPI boundaries rather than transforming only their center point.
- Check display metadata consistency in Control Center; this is **not** physical target-accuracy calibration.
- Maintain small MCP tool schemas and read-only, local-first behavior.

## v0.12.0 — local MCP connection check and display layout

- Add an isolated real stdio-MCP preflight: initialize, tool discovery, and read-only headless screen geometry. No host registration is assumed.
- Surface manual diagnostics and code-specific recovery in Control Center without collecting task data.
- Visualize global DIP display bounds and scaling (including negative monitor origins).
- Copy an allowlisted support report free of paths, tokens and task content.
- Add subprocess timeout, ownership and bounds tests and a three-platform CI connection check.

## Unreleased — desktop Control Center

- Dedicated four-page native desktop management window (overview, Agent connections, appearance, diagnostics).
- Read-only, desktop-authenticated, owner-redacted diagnostics with honest Agent activity semantics.
- Reusable host config generator, user preference persistence, read-only UI lookup consent; tray shortcut.
- Sandboxed renderer, no new framework or model dependency; regression and privacy tests.

## 0.4.0 — lightweight multi-harness integration (2026-10-18)

- Add stable `requestId` for idempotent human handoff retries (without resetting user timer).
- Add a bounded async wait pool and explicit overload response.
- Add compact model tool results opt-in (`HANDOFFGLASS_OUTPUT=compact`), preserving the default JSON contract.
- Generate compatible MCP stanzas for Claude, Codex, Cursor, VS Code, Copilot, Gemini and Zed using one shared host adapter.
- Move Electron to optional dependency; CI runs MCP-only to avoid downloading the desktop binary.
- Add asynchronous panel decision acknowledgement with retryable failure state, nonblocking visual guide mode, multi-spotlight compositing and boundary-spanning screen annotations.
- Add host, compact-output and retry regression tests, benchmark harness and Code Agent handoff instructions.
- Expose an optional MCP `assist-with-ui-step` prompt for hosts that support prompts, with full tool compatibility preserved.
- Add opt-in, dry-run-first JSON host config installer with collision rejection, backup and atomic write.
- MCP/broker tests are not a substitute for GUI acceptance on a physical Windows/macOS machine.

# Changelog

## 0.3.0 — 2026-10-17

- Split MCP stdio adapters from one lazy-started local Broker; state and Electron are no longer duplicated across hosts.
- Owner isolation: one host cannot supersede, inspect or cancel a session owned by another; busy conflicts are explicit.
- Atomic single-instance startup coordination, private runtime manifest, credential separation and stale-broker recovery.
- Broker status/stop commands, cross-host protocol regression testing, runtime crash/restart coverage.
- Desktop reconnect now requires a fresh renderer heartbeat, and display layout refreshes are debounced.
- Desktop acceptance checklist and rewritten trust/architecture documents.
- Safe zero-write config generator for MCP JSON and Codex TOML, with Windows path quoting tests.
- npm dependency lockfile generated in GitHub Actions and committed; CI now uses `npm ci` on all three operating systems.

## 0.2.0 — 2026-10-17

- Coordinate-free human handoff and up to eight confirmed target annotations.
- Explicit immutable session state, bounded history and truthful user-reported completion semantics.
- Versioned snapshot bridge with reconnect consistency; stronger input validation and loopback hardening.
- Multi-display coordinate utilities and safer Electron IPC decisions.
- 16 unit tests, SDK smoke script, optional manual desktop smoke and CI workflow.
- Expanded README, security document, product and engineering roadmap.
- Post-import fix: treat MCP SDK v2 `serveStdio` as a synchronous handle; GitHub Actions subsequently passed on Linux/macOS/Windows.

## 0.1.0 — 2026-10-16

- Initial MCP tool definitions, one-target desktop overlay, local bridge and prototype UI.

## Unreleased — independent Agent readiness

- Harden loopback routing with explicit HTTP method enforcement and cap simultaneous long-poll responders.
- Add regression tests for method confusion and resource exhaustion.
- Add `AGENTS.md` and `docs/AGENT_HANDOFF.md` with operational boundaries, priorities, commands and per-platform acceptance criteria.

## v0.5.0 — reusable layered visual scenes

- New dependency-free Scene v1 protocol with six composition templates, seven annotation shapes, shared semantic palette and atomic scene edits.
- New MCP `visual_scene_update` (owner scope, expected revision, no renewed TTL) and `template` / `scene` options in existing tools.
- Single production SVG renderer also used by the local gallery; no second renderer or preview-only SVG approximations.
- Portable JSON Schema, three realistic synthetic scene fixtures, product interaction and visual design handbooks.
- Additional unit, bridge, renderer and live MCP integration regression tests. Physical desktop acceptance still outstanding.

- Added fail-closed UI grounding candidate contract and tests (pure library, no active AX/UIA enumeration), and minimal scene template/validation CLI for future adapters.

- Fix stale-manifest broker restart on Windows by clearing the failed manifest under the startup lock before spawning, and surface asynchronous process-launch errors.

- Electron overlay now loads a deterministic classic-script bundle of the same canonical SVG renderer used in gallery; avoids file-URL ESM issues without adding a bundler dependency.

- Normalize renderer source and generated bundle line endings; `.gitattributes` enforces LF across hosts so Windows CI performs the same deterministic integrity check.

## 0.6.0 — Native integration engineering preview

- Add explicitly opt-in, read-only macOS Accessibility and Windows UI Automation foreground-control adapters with fail-closed matching and Electron DPI evidence.
- Add `ui_locate` MCP tool and `target:{app,role,name}` on guide/handoff requests.
- Add standalone packaged Electron GUI bootstrapping its own shared loopback broker, per-user accessibility toggle and lightweight tray interface.
- Add source/desktop dual-runtime documentation and unsigned Windows/macOS packaging workflow.
- Add Cline, Windsurf and OpenCode MCP configuration generation.
- Preserve no-click/no-credential/no-telemetry constraints. Real OS app startup, permissions and GUI tests are still mandatory.

## v0.7.0 — local-first harness integration and refined motion

- User-controlled, on-disk visual preferences (no approval/screen history), selectable from desktop tray.
- Deterministic localized handoff blueprints; optional compact MCP context and blueprint tools.
- Native DeepSeek Harness Cordis plugin source and local-checkout patch generator.
- Tencent WorkBuddy MCP+Skill connector generator and TRAE/DeepSeek/WorkBuddy MCP config entries.
- Declarative integration support matrix, strict unsupported flags for unverified desktop apps.
- Production SVG hand-drawn stroke, refined glass/aura animation, progressive readable panel, reduced-motion support.
- New tests for preferences, connectors, host strategies, local decision plans and CSS contracts.

- Desktop decision panel is bilingual (zh-CN/en-US) and density-aware; preferences appear in the tray and are applied by the broker without a model call.

## Next — autonomous Agent preflight and release reliability

- Add deterministic local-first `handoff_assess` optional tool and policy matrix for all six high-frequency scenarios, including ambiguous/stale/offscreen evidence and sensitive human decisions.
- Add environment readiness CLI with machine-readable JSON and explicit desktop QA boundaries.
- Harden packaged Windows Electron MCP smoke cleanup against short-lived file locks using bounded filesystem retries.
- Extend MCP extras handshake smoke, local policy and readiness regression suites. Keep default eight model-facing tools unchanged.
- Add `docs/AGENT_AUTONOMY.md`, an actionable Agent/Harness selection and verification contract without unrestricted memory access.

- Add offline compact MCP response byte benchmark (avoids unsupported token-saving claims).

- Packaging regression follow-up: explicitly terminate the isolated headless Broker spawned by the packaged MCP test before removing its runtime directory. Merely retrying EBUSY was insufficient (see Actions run 39146346211).

## Unreleased — visual cohesion and first-run usability

- Rebuilt the local setup window with a calm dual-surface layout and responsive vector illustration.
- Added a read-only, host-specific MCP configuration preview with safe concurrent selection handling.
- Fixed source-mode Electron's stdio MCP launch config by explicitly setting `ELECTRON_RUN_AS_NODE=1`.
- Unified first-run and handoff panel color/typography tokens, with system/dark/light appearance preferences.
- Refined decision layout, keyboard focus, high-contrast and reduced-motion behavior.
- Added a scalable, reusable Agent → Human → Agent infographic to all three README languages.
- Added UI contract tests and `docs/INTERFACE_SYSTEM.md`.
