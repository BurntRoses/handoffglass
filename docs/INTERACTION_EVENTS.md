# Incremental handoff events

HandoffGlass observes handoff transitions locally. This interface allows a calling Agent to recover context after a temporary pause without restating the entire screen or waiting for a model to infer what happened.

## Continuous event waiting

`session_start` and `session_present` return `nextCursor` with their current snapshot. Use it in `session_wait({sessionId,cursor,maxWaitSeconds:20})` to skip setup events already acknowledged by that response. Carry `nextCursor` on subsequent calls; use `cursor:0` to read retained history. Available meaningful events return immediately; otherwise the Broker waits up to 30 seconds. Ordinary target motion is coalesced and does not wake the waiter on its own. The response includes the current session, `nextAction`, events, cursor and truncation status in one call.

Continuous events include `session_started`, `scene_updated`, `user_action`, `verification_required`, `agent_ready` and `session_finished`, plus native tracking transitions. Each event has `sessionId`, `sequence`/`cursor`, `timestamp`/`at`, `source:broker` and `nextAction`. User reports retain session ownership during verification. `session_present` needs the same `sessionId`; `session_verify({verified:true,finish:true})` ends the final verified step.

A host must maintain the Agent tool loop. MCP long waiting cannot resume a model after the host has ended its turn. A timeout requires no new screen read or narrated explanation.

## Legacy read-only event snapshot

`HANDOFFGLASS_LEGACY_TOOLS=1` exposes `handoff_events({sessionId, after:0, limit:20})` for older clients. It returns:

```json
{
  "events": [
    { "cursor": 1, "type": "started", "at": 1792400000000 },
    { "cursor": 2, "type": "target_acquired", "at": 1792400000500 },
    { "cursor": 3, "type": "target_lost", "at": 1792400003000, "reason": "target_not_found" }
  ],
  "nextCursor": 3,
  "truncated": false,
  "more": false,
  "recovery": "await_reacquisition",
  "note": "Events are local observations, not proof of downstream task success."
}
```

Use `nextCursor` as the next call's `after` value. Set `limit` between 1 and 32. No background model work is required; the native tracker produces transitions. Missing events caused by bounded retention set `truncated: true`. A future cursor is clamped to the current session cursor. Read access is scoped to the MCP connection owner, with the same bearer and per-connection owner ID requirements as `handoff_status`.

### Recovery policy

| Recovery code | Meaning / action |
|---|---|
| `await_human_or_continue` | Await the person's decision or continue non-sensitive work. |
| `await_reacquisition` | Locator lost exact target; do not point to the old position. Wait for a new grounded observation. |
| `await_display_recalibration` | Display layout changed; wait for fresh display and native target coordinates. |
| `check_accessibility_permission` | Native inspection consent/OS permission is unavailable; ask the person to review settings, no auto-approval. |
| `check_desktop_connection` | Desktop bridge is temporarily unavailable. |
| `agent_owns_scene` | A manual scene edit relinquished automatic native following. |
| `verify_downstream` | Person reported completion; independently verify the actual app/file/permission state. |
| `respect_refusal`, `stopped` | Do not resubmit the same sensitive decision. |
| `request_again_if_needed`, `follow_new_session` | Original session expired or was superseded; re-evaluate task intent and ownership before taking further steps. |

## Event privacy and limits

Events contain a session ID, numeric sequence/cursor, allowlisted type/next action, timestamp, fixed source and optionally an allowlisted failure code. No UI text, coordinates, screenshots, file paths, target names, session inputs, account identifiers or tokens are persisted to this journal. The journal stays in Broker memory, currently retains at most 32 events per session and 64 sessions, and disappears when the Broker exits. Desktop diagnostics displays only recent event codes, localized for the person; it cannot display Agent session IDs or task text.

## Recovery across process restarts

A Broker process may outlive its individual MCP stdio clients. However, **new MCP processes do not inherit the old process's owner capability**. A new process cannot silently claim another owner's session by knowing its ID or a guessable request ID. The `handoff_events` and `handoff_status` tools work for the original live owner's connection. Cross-process resumption would require a separately designed, explicit, securely scoped handover capability; it is not implemented here.

## Native target safety

If native tracking is `lost`, `layout_changed`, or `desktop_unavailable`, `session_update` rejects mutations with `target_unavailable`, preventing stale overlay coordinates from being republished. Once a verified read restores the target, the original owner can update the scene again. Editing a tracked scene while the target is valid relinquishes automatic tracking and marks the state `manual`.

Native target motion, display reconfiguration, renderer hit testing and visual alignment still require desktop hardware QA. Headless tests verify contracts and error paths, not pixels.
