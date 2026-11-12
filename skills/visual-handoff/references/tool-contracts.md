# Host observation and coordinate contract

The host supplies evidence through its own authorized tools; HandoffGlass never captures the screen. An observed rectangle is **top-left** x/y plus width/height, not a center point. Examples below are illustrative measurements, not real application targets.

```js
// Values come from the host's authorized observation, including actual capture time.
const {capturedAt,layoutSignature,provenance}=hostObservation;
const observation={capturedAt,layoutSignature,provenance};
const mark={shape:"spotlight",bounds:hostObservation.bounds,observation,label:"左侧边栏"};
```

Without frame, bounds are global DIP. For an image resized to 1000×600 representing a 500×300 DIP window at (-1200,80), a pixel target (20,40,200,80) maps locally to global DIP (-1190,100,100,40):

```js
const mark={shape:"box",bounds:{x:20,y:40,width:200,height:80},
  frame:{width:1000,height:600,bounds:{x:-1200,y:80,width:500,height:300},
    capturedAt:hostObservation.capturedAt,layoutSignature:hostObservation.layoutSignature,provenance:"host"},
  color:"#75b9ff"};
```

`frame.bounds` describes the **exact supplied image**, including any crop; it is not automatically the full app or monitor. A frame must fit one connected display. For mixed-DPI displays, submit separate frames per display or independently measured global DIP regions. Do not invent a common physical pixel scale. `capturedAt`, `layoutSignature` and `provenance` are required: put them in frame, or in observation for global DIP. `capturedAt` is the actual evidence time (maximum age 30 seconds), not the time of a later tool call. Reuse host layout metadata or cache `screen_displays.layoutSignature`; never invent it. Missing evidence returns `observation_required`. Do not query displays when the host already provides a reliable mapping. Layout metadata is not evidence that an app control exists.

`screen_mark`, `session_start`, `session_present` and `session_update` share bounds/frame. Fixed marks have no native following; new window position requires new evidence. Scene patches do not reset deadlines or verify actions. A display layout change clears fixed drawings and blocks fixed task guidance until fresh presentation.

The Codex plugin uses `HANDOFFGLASS_TOOL_PROFILE=host` (18 tools): host bounds and lightweight session schemas. Standalone defaults to `full` (20 tools), retaining native targets, layered scenes and legacy coordinate inputs. `HANDOFFGLASS_LEGACY_TOOLS=1` adds old aliases separately. Native target APIs remain opt-in by local consent and OS access. Neither profile bypasses protected host applications.

## Quick drawing and parked delivery (0.19)

`screen_mark({shape:"ring",size:220,durationSeconds:20})` draws directly at the primary display center and auto-clears. No observation or wait. Returns `{id,revision,count,expiresAt,nextAction:"done",localMs}`. An active task or another owner returns `busy`.

- Circle with caption: `{shape:"scribble",placement:"left",width:280,height:160,label:"查看这里"}`.
- Focus and pointer: `{marks:[{shape:"spotlight",placement:"left",width:400,height:240},{shape:"arrow",placement:"right",direction:"left",label:"从这里开始"}],sequence:true}`.
- Edit: `{action:"update",id,expectedRevision:revision,color:"#75b9ff",placement:"top_right"}`. Save the returned revision. Unspecified values are retained; `marks` replaces the group. Expiry is unchanged.
- Remove: `{action:"clear",id,expectedRevision:revision}`. No waiting. `revision_conflict` returns the current `revision`; do not blindly retry stale edits.

Placement accepts center, top, bottom, left, right and four corner names (`top_left`, etc.). `direction` is the arrowhead direction. `lineStyle:"dashed"` and `strokeWidth:1..8` apply to outlines. Per-mark `position:{x,y}` is explicit global DIP supplied by the user or independent measurement; never guess application controls. `displayId` selects a connected screen. Disconnected displays return `no_display`.


`session_start execution:"parked"` leaves native tracking, rendering and user actions with the Broker. `session_wait` returns immediately with `nextAction:"yield_to_user"`, events and `nextCursor`. Stop the chat turn; retain id, token and cursor. `session_control action:"park"|"attach"` changes delivery without changing step, clearing marks or claiming verification. The App's current-status disclosure offers the same action. Pausing hides marks; parking retains them. User reports remain `verified:false`; on return attach, inspect, verify, then present. SessionEnd retains a parked task; an explicit interrupt pauses it. Broker restart restores only minimal recovery evidence and requires fresh observation.

# Tool contracts for setup or troubleshooting

The live MCP schemas are authoritative. Read this reference when a host cannot show them or when explaining an example; it is not needed for each step.

| Tool | Required inputs | Defaults / output |
| --- | --- | --- |
| `capability_manifest` | none | workflow, valid example arguments, recovery and transport limits |
| `screen_displays` | none | fresh global DIP display bounds, no screenshot |
| `ui_inspect` | none | up to 48 foreground controls, bounded labels and bounds |
| `ui_locate` | `target:{app,role,name}` | exact observed control; optional previous bounds for comparison |
| `review_changes` | `action:present|status|wait`; changes for present | summaries and hashes; reviewed/declined is a human review, not independent verification |
| `session_start` | `title`, `message` | `mode:handoff`; optional host bounds/frame; full profile also accepts native target or scene; `timeoutSeconds:1800`, separate task deadline; returns session, resumeToken, nextCursor, nextAction |
| `session_present` | `sessionId`, `title`, `message` | same drawing fields; fresh requestId per step; new step deadline; task deadline remains |
| `session_wait` | `sessionId` | `cursor:0`, `maxWaitSeconds:20` (0–30); events, nextCursor, truncated, session, nextAction |
| `session_update` | `sessionId`, `expectedRevision`, `bounds` | optional frame; full profile also accepts scene operations; no timeout renewal |
| `session_verify` | `sessionId`, `result:verified|mismatch|inconclusive` | `finish:false`; final verified step needs `finish:true` |
| `session_resume` | `sessionId`, `resumeToken` | rotates token; clears marks; fresh observation required |
| `session_control` | `sessionId`, `action` | pause/resume/retry_target/text_fallback/progress; expectedStep prevents stale actions |
| `integration_uninstall` | optional `confirm` | full owned-install preview, or scheduled removal and result path |
| `session_stop` | `sessionId` | cancels only the calling owner's session |
| `connection_status` | none | Broker, desktop, enablement; caller-declared host identity |
| `permission_status` | none | local consent and status-only OS/helper check |
| `integration_set_enabled` | `enabled:boolean` | user-requested pause/resume; settings kept |
| `integration_status` | optional `host` | host defaults codex; local files only; host trust/binding not observed |
| `integration_cleanup` | `host:codex|workbuddy` | `confirm:false`; items, retained, scope, hostAction, applied |

For a native observed button (full profile only):

```json
{"title":"打开设置","message":"点击标出的设置按钮。","target":{"app":"observed app","role":"observed role","name":"observed name"},"requestId":"task-step-0001"}
```

Store the returned `session.id` and `nextCursor`. For example, `{"sessionId":"00000000-0000-4000-8000-000000000001","cursor":1,"maxWaitSeconds":20}`; replace the example UUID and cursor with the actual response values. When `nextAction:verify_in_app`, inspect the original application, then record `{"sessionId":"00000000-0000-4000-8000-000000000001","result":"verified","finish":false}` using the same actual session ID. Show another step with `session_present` and that same ID, or use `finish:true` for final verified completion.

Targets and app content must come from a fresh observation. The placeholders above are not real target names. The MCP never clicks, types or grants system permission.

Failures include `disabled_by_user`, `continuous_disabled`, `consent_required`, `permission_denied`, `busy`, `target_unavailable`, `verification_due` and `revision_conflict`. For a revision conflict read the current snapshot with `session_wait(maxWaitSeconds:0)`, then decide whether the patch is still relevant. Reconnects on the same MCP process can resume a cursor; process replacement requires session_resume with the saved token. Management tools work while guidance is disabled.

Drawing options are shared by `session_start`, `session_present` and scene annotations. `capability_manifest.visuals` groups the live shapes and templates by purpose. `effect:draw|fade|pop|pulse|flow|still`, `exit:fade|retract|shrink`, `maskStyle:soft|crisp|deep` (spotlight), bounded `delayMs` and `durationMs` are optional. Keep mark IDs stable during movement. The desktop animates retirement after a user report; stale targets, disable, pause and disconnect clear immediately. A check/cross glyph never changes verification state.
