# Tool contracts for setup or troubleshooting

The live MCP schemas are authoritative. Read this reference when a host cannot show them or when explaining an example; it is not needed for each step.

| Tool | Required inputs | Defaults / output |
| --- | --- | --- |
| `capability_manifest` | none | workflow, valid example arguments, recovery and transport limits |
| `screen_displays` | none | fresh global DIP display bounds, no screenshot |
| `ui_inspect` | none | up to 48 foreground controls, bounded labels and bounds |
| `ui_locate` | `target:{app,role,name}` | exact observed control; optional previous bounds for comparison |
| `session_start` | `title`, `message` | `mode:handoff`; optional native target or grounded scene/marks; `timeoutSeconds:300` (`guide:90`); returns session, nextCursor, nextAction |
| `session_present` | `sessionId`, `title`, `message` | same drawing fields; fresh requestId per step; original session timeout remains |
| `session_wait` | `sessionId` | `cursor:0`, `maxWaitSeconds:20` (0–30); events, nextCursor, truncated, session, nextAction |
| `session_update` | `sessionId`, `expectedRevision`, `operations` | patch an enabled scene atomically; no timeout renewal |
| `session_verify` | `sessionId`, `verified:boolean` | `finish:false`; final verified step needs `finish:true` |
| `session_stop` | `sessionId` | cancels only the calling owner's session |
| `connection_status` | none | Broker, desktop, enablement; caller-declared host identity |
| `permission_status` | none | local lookup consent; OS access remains not_checked until native inspection |
| `integration_set_enabled` | `enabled:boolean` | user-requested pause/resume; settings kept |
| `integration_status` | optional `host` | host defaults codex; local files only; host trust/binding not observed |
| `integration_cleanup` | `host:codex|workbuddy` | `confirm:false`; items, retained, scope, hostAction, applied |

For an observed button:

```json
{"title":"打开设置","message":"点击标出的设置按钮。","target":{"app":"observed app","role":"observed role","name":"observed name"},"requestId":"task-step-0001"}
```

Store the returned `session.id` and `nextCursor`. For example, `{"sessionId":"00000000-0000-4000-8000-000000000001","cursor":1,"maxWaitSeconds":20}`; replace the example UUID and cursor with the actual response values. When `nextAction:verify_in_app`, inspect the original application, then record `{"sessionId":"00000000-0000-4000-8000-000000000001","verified":true,"finish":false}` using the same actual session ID. Show another step with `session_present` and that same ID, or use `finish:true` for final verified completion.

Targets and app content must come from a fresh observation. The placeholders above are not real target names. The MCP never clicks, types or grants system permission.

Failures include `disabled_by_user`, `continuous_disabled`, `consent_required`, `permission_denied`, `busy`, `target_unavailable`, `verification_due` and `revision_conflict`. For a revision conflict read the current snapshot with `session_wait(maxWaitSeconds:0)`, then decide whether the patch is still relevant. Reconnects on the same MCP process can resume a cursor; process replacement does not inherit the owner capability. Management tools work while guidance is disabled.
