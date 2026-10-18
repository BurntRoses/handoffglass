# Layered scenes and incremental operations — Protocol v1

## Intent

Keep HandoffGlass small: no second process, no new database, no image models. One pure JavaScript module (`src/visual/scene.mjs`) is the common source of truth for model-provided scene descriptions, template composition, validation, flattening and atomic edits. The actual desktop renderer is SVG (`src/desktop/overlay-renderer.mjs`).

## Creation — existing tools, backward compatible

The six legacy MCP tool names continue to operate as before. `visual_show` and `handoff_request` can now additionally accept either `template` or `scene`. The following are mutually exclusive: `scene`, `template + (x/y or annotations)`, legacy `x/y`, legacy `annotations`.

### Smallest semantic request

```json
{
  "title": "Review permissions", "message": "Check the access list and decide whether to continue.",
  "template": "caution", "x": 560, "y": 350,
  "requestId": "access-review-2026-001"
}
```

Use in `handoff_request` for user input or `visual_show` for non-blocking visual instruction. Do not send `template` without grounded targets; if no measured target is available use coordinate-free `handoff_request` without any marker.

### Explicit layered scene

```json
{
  "title": "Configure workspace", "message": "Review these two options.",
  "scene": {"version": 1, "layers": [
    {"id":"context", "zIndex":0, "opacity":0.6,
     "annotations":[{"id":"option_a","x":250,"y":200,"shape":"box","tone":"neutral"}]},
    {"id":"attention", "zIndex":20,
     "annotations":[{"id":"option_b","x":440,"y":250,"shape":"arrow","tone":"info","label":"Review details"}]}
  ]}
}
```

The result includes `session.id` and `session.sceneRevision=1`; compact model-output mode retains the revision number.

## Updating without changing task ownership

Call MCP tool `visual_scene_update`:

```json
{
  "sessionId": "UUID_FROM_VISUAL_SHOW",
  "expectedRevision": 1,
  "operations": [
    {"op":"set_layer", "layerId":"context", "visible":false},
    {"op":"upsert_annotation", "layerId":"attention",
     "annotation":{"id":"option_c","x":720,"y":280,"shape":"underline","tone":"info"}}
  ]
}
```

Supported commands: `upsert_layer`, `remove_layer`, `set_layer`, `upsert_annotation`, `remove_annotation`. Upsert means replace by the same stable ID, or append a new one. All operations are checked against an isolated copy, then committed together (atomic). Invalid operations do not partially change state.

Semantics:

- Exactly one active HandoffGlass session; **only its owning MCP host** may change its scene.
- `expectedRevision` is mandatory. A stale client gets `revision_conflict`, not an accidental overwrite. Read `handoff_status` to obtain a fresh revision before rebuilding the intended patch.
- A successful patch increments `sceneRevision` and the desktop snapshot revision, but **does not extend TTL**, complete a user action, or claim `verified=true`.
- Finished, expired or superseded sessions reject changes. Legacy non-scene sessions remain immutable (create a new scene to use incremental updates).
- Hidden layers can temporarily make every marker disappear while retaining the session/panel for user control.
- Scene version is fixed at `1`. Unknown versions fail closed; future versions require explicit migration.

## Boundaries / error mapping

| Condition | Behavior |
| --- | --- |
| Invalid mark, layer, template or operation | HTTP 400 / MCP tool error |
| Different owner | HTTP 404: session not found (no session discovery) |
| Mismatched scene version / stale scene revision | HTTP 400 / HTTP 409 |
| Expired or completed session | HTTP 409: already final |
| Coordinates outside active displays | HTTP 422: outside_display |
| No active GUI renderer (non-headless) | HTTP 503: no_desktop for initial show |
| Same scene mutation retried with stale version | HTTP 409: revision_conflict; inspect state before retry |

## Constraints

All coordinates are **global device-independent pixels (DIP)**, not screenshot pixels. Use grounded bounds from another tool, not model hallucinations. No UI automation, authorization approval, screen capture, OCR, credential reading, or protected desktop access is implied by a visual scene. User-reported `completed` is not independent verification.

JSON Schema: [`schemas/scene-v1.schema.json`](../schemas/scene-v1.schema.json); executable validators remain in `src/visual/scene.mjs`. Fixtures live in `examples/scenes/`.
