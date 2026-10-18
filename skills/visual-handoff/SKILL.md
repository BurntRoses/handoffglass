---
name: visual-handoff
description: Use HandoffGlass MCP to annotate an observed GUI or request a safe human handoff for account login, MFA, permission review, or a blocked desktop step, then verify the real downstream result before continuing.
---
# Visual Handoff — Agent Skill

This Skill assumes the `handoffglass` MCP server is installed and linked to your host.
The tool never operates the mouse/keyboard or captures the screen.

## Trigger
- Sensitive steps require informed user approval: login, passkey, MFA, payment, permission changes, destructive actions.
- An automated action is unreliable or unusually costly; a short user action would be simpler.
- The user asks for on-screen guidance.

## Workflow
1. Explain **why** human action is needed, and what permission/data/action is involved. The user can refuse.
2. If a target was observed via an *independent* verified computer-use/accessibility source, call `screen_displays` and convert observed pixels to Electron global DIP before using x/y. A screenshot alone with unknown scaling is **not** sufficient grounding.
3. Use `handoff_request` with `title` and `message`. For retries supply a stable `requestId` (8–96 alphanumeric/dot/colon/dash/underscore characters) to avoid duplicate overlays. For **unknown target coordinates omit x/y and annotations entirely**. This is preferable to guessing. For multi-target teaching, supply up to 8 grounded annotations with x/y, label, shape, color, optional width and height.
4. Store `session.id`. Call `handoff_wait` (up to 30s) or `handoff_status`; check `status`. Pending is not completion. A second request **from this same Agent** supersedes its previous one; a different Agent receives `busy` rather than overwriting another handoff.
5. `completed` means only **user reported completion**, with `verified: false`. Use your original Computer Use, API or application state checker to verify before continuing.
6. On `busy` do not repeatedly take over; inform the user another Agent has the active screen. On `declined`, `cancelled`, `expired`, `superseded`: do not claim success; provide a safe alternative or stop.
7. For nonblocking illustration use `visual_show` with verified target coordinates. `visual_show` only shows the click-through overlay and does not open the action panel; cancel it or let it expire. When finished, call `handoff_cancel` on that session ID.

## Examples

Permission review without coordinates:
```json
{"title":"请核对授权范围","message":"在原始应用中核对权限名称与账户，自行决定是否允许；完成后点‘我已完成’。"}
```

Two guided targets:
```json
{"title":"找到两个设置项","message":"先阅读权限，再查看退出选项。","annotations":[{"x":320,"y":240,"shape":"ring","label":"权限信息"},{"x":740,"y":510,"shape":"box","width":160,"height":54,"label":"取消按钮"}]}
```

## Hard boundaries
- Never ask for passwords, one-time codes or bank details in MCP tool arguments or chat.
- Do not use HandoffGlass to bypass CAPTCHA, security controls, user consent or the operating system's protected desktop.
- Avoid unconditional instruction to click Allow, Pay or Delete; explain implications and give a refusal path.
- Do not claim the overlay sees pixels, reads DOM, or verifies action success. That requires separate capabilities.
- Do not mix stale screenshot physical pixels with DIP screen coordinates.
