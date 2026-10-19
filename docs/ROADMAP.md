# Roadmap

HandoffGlass is currently a **private, unsigned engineering preview (0.15.x)**. The local MCP Broker, owner-scoped handoff state, opt-in native targeting, incremental events, scenes, Control Center and host config generators exist in source. Headless CI and packaged MCP tests are not substitutes for real desktop validation.

## P0 — finish the actual user workflow

- [ ] [#1 macOS / Windows desktop acceptance](https://github.com/BurntRoses/handoffglass/issues/1): show overlay on installed app, click-through, panel focus, display changes, full-screen and crash recovery. Record device evidence.
- [ ] [#3 native target accuracy](https://github.com/BurntRoses/handoffglass/issues/3): exact AX/UIA foreground targeting, permission denial, occlusion and drift under window movement and mixed-DPI multi-monitor setups. Fail closed.
- [ ] [#9 real Agent adoption](https://github.com/BurntRoses/handoffglass/issues/9): end-to-end Codex first, then DeepSeek Harness, WorkBuddy and Trae. Require actual tool invocation and task continuation, not config-shape checks.

## P1 — ready to distribute

- [ ] [#4 distribution](https://github.com/BurntRoses/handoffglass/issues/4): clean install/upgrade/uninstall, broker startup without external Node, OS permission UX, signed macOS/Windows installers after field tests.
- [ ] Safe abandoned-session recovery design if demanded by real hosts; no cross-owner session claiming without authentic, OS-local authorization.
- [ ] Close UX defects found in actual user journeys; keep the default tool surface minimal.

## P2 — evidence of impact

- [ ] [#10 effectiveness](https://github.com/BurntRoses/handoffglass/issues/10): real model tokens, correct-target rate, time to resume, user refusals and task success; compare text-only/static/tracked handoffs.
- [ ] Native accessibility and visual quality improvements, guided by measured desktop results rather than effect count.

**Do not use this file as evidence that a checkbox passed.** Test data belongs in a linked PR/Issue, with the exact build SHA, OS and reproduction steps. Start at [Codex handoff](CODEX_HANDOFF.md).
