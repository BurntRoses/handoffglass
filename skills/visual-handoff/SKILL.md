---
name: visual-handoff
description: Draw or revise desktop annotations from host-observed regions, or guide a user through a screen task. Also pause, remove a connection or uninstall HandoffGlass when asked.
---

# HandoffGlass

The host observes and verifies. HandoffGlass maps coordinates, draws, animates and records local user events. Reuse the host's existing authorized screenshot, DOM or UI evidence; do not add native inspection, capability queries or permission checks before drawing. HandoffGlass does not capture the screen or operate the original app.

## Choose the shortest route

| Request | Route |
| --- | --- |
| “画个圈”“屏幕左侧画椭圆” | `screen_mark` once with shape/placement/label; no inspection or wait |
| Highlight an actual app region | Existing host observation → `screen_mark` with `bounds`; read the app once only if evidence is missing |
| Revise / clear | `screen_mark(action:"update"|"clear",id,expectedRevision)`; save returned revision |
| Teach or hand over one action | Host observe → `session_start` with bounds and one short instruction |
| Continue a parked task | `session_control(action:"attach")` → host observe → `session_verify` → `session_present` |
| Review changes | `review_changes(action:"present",changes)` → `wait`/`status`; summaries + hashes only; decline/timeout stops continuation |
| Connection / optional native lookup problem | `connection_status` / `permission_status`, only for that problem |
| Disable / enable | `integration_set_enabled`, only on the user's request |
| Remove a connection / the application | `integration_cleanup` / `integration_uninstall`: preview then apply the requested removal |

For an application target, use measured bounds; named placement describes a decorative screen region, not an identified control. Each application target requires `capturedAt` (actual observation time, epoch ms), `layoutSignature` (current 16hex display signature), and `provenance:host|native|user` in `observation`, or inside `frame`. Reuse host metadata; if only the layout signature is missing, read `screen_displays` once and cache it until displays change. Never fabricate evidence or reset its timestamp. Older than 30 seconds is rejected and displayed fixed geometry clears at expiry. Without evidence use a coordinate-free step. With no `frame`, `bounds:{x,y,width,height}` is a top-left rectangle in **global DIP**. With `frame`, bounds are pixels in that exact image; frame contains its pixel `width,height` and corresponding **global DIP** `bounds`. The renderer converts crop, resize and scale locally. Use one frame per display; never assume a screenshot pixel equals a DIP. If the host does not supply a reliable mapping, use text guidance or user-supplied evidence. Do not ask the user for tool names or coordinates.

Host observations may be unavailable or protected (including Codex's own window in Computer Use). Stop that observation route; never bypass restrictions through another capture API, shell or native locator. Explain the specific limitation. Missing HandoffGlass Accessibility access does not block drawing an already authorized host observation. Native `ui_inspect`/`ui_locate` are optional in the **full** tool profile, for explicitly available native observation/following; they are not a compulsory fallback.

## Drawing

Choose shape, label and style in one call; never animate by calling tools repeatedly. `marks` composes up to eight shapes; `sequence:true` adds numbers locally. Save `id` and `revision`. Update keeps expiry; `marks` replaces the group. Clear only your own drawing. Fixed host marks do not follow moving windows: use a fresh observation to update or clear them. A display layout change clears them. No task session or long wait is needed for a mark.

## Guided tasks

1. Present one action with `title`, `message` and observed `bounds` (optional frame); omit bounds for text guidance. Keep sensitive choices with the user using `sensitive:true` and `completion:{kind:"user_report"}`.
2. Default `execution:"parked"` keeps the local card and events alive while chat returns. On `yield_to_user`, end the turn with one short status; no wait loop. `pause` hides marks; `park` retains them. An idle model cannot be awakened by this plugin.
3. For an active multi-step task use `execution:"attached"`, `session_wait(cursor)` and the same session. Empty waits need no narration or re-inspection. On user action, independently observe the original app and `session_verify` with `expectedStep`. A user report is never verification.
4. Only final confirmed success uses `result:"verified",finish:true`. Use `result:"mismatch"` for a failed check and `result:"inconclusive"` when the result cannot be inspected; never repeat the user action to fill missing evidence. After a conclusive check, `session_present` advances the same session with fresh evidence and a new `requestId`. `session_update(bounds,expectedRevision)` only moves/revises the current mark; it does not verify or advance.

Save session ID, recovery token and cursor privately in task context. After process replacement, `session_resume` rotates the token and clears marks. Follow `observe_app`, `verify_in_app` or `wait_for_resume`; never replay a user action. Report progress only when actually observing or verifying, without percentages or invented model state.

## Recovery and removal

- Refusal, cancellation, `disabled_by_user`, `continuous_disabled` or `busy`: stop. Enable only when asked.
- `declined_by_user`: stop; a new request ID or visual style does not reopen the rejected step. Use `retryDeclined:true` in a new presentation only after the user explicitly asks to try that step or review again. Never set it for an automatic retry.
- `observation_required`, `stale_observation`, `layout_changed`, `outside_frame`, `ambiguous_frame` or `outside_display`: obtain fresh host evidence and its mapping; never guess scale or silently clamp a target.
- Native `permission_denied`/`consent_required`: explain optional native access once; keep host drawing available. Do not change permission yourself.
- `verification_due`/`step_not_verified`: check the original app. `revision_conflict`/`stale_step`: use the returned revision or current snapshot; do not blindly repeat edits.
- Invalid recovery token: do not claim ownership. `truncated:true`: continue from the current snapshot and next cursor.
- “移除 Codex 接入” uses integration cleanup; “卸载 HandoffGlass” uses full uninstall. The user's removal request authorizes applying the preview. Preserve unrelated settings, edits and unmanaged files; report retained items, scheduled cleanup and required host reload.

Read [tool contracts](references/tool-contracts.md) only for coordinate examples, native following or recovery details. Live tool schemas are authoritative; do not reread this reference each step.
