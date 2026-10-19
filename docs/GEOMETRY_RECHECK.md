# Grounded target recheck and display metadata

HandoffGlass uses device-independent global desktop coordinates (**DIP**). macOS Accessibility observations already use desktop coordinates; Windows UI Automation exposes physical pixel rectangles which require a per-monitor transform.

## Safe mapping

On Windows, the locator now requires the **whole** UIA rectangle to fit inside exactly one current monitor's physical bounds. If a target spans displays, falls outside them, or cannot be mapped with a consistent scale, the locator rejects it with `display_mapping`. It will not guess from a center point.

Control Center → Diagnostics shows screen positions and a *metadata consistency* result. A passing check means the returned rectangles and scales satisfy structural rules. It does **not** prove an overlay aligns with physical controls in a real application. Multi-monitor plug/unplug, system zoom, virtual desktops and secure system windows still require physical acceptance testing.

## Reobserve an exact control

With read-only native UI lookup explicitly enabled, `ui_locate` accepts the same exact `{app,role,name}` query plus an optional **previous** observation:

```json
{
  "target": {"app":"ExampleApp","role":"button","name":"Continue"},
  "previous": {"x":800,"y":450,"width":120,"height":36,"layoutSignature":"0123456789abcdef"}
}
```

The earlier coordinates and layout signature should be taken from a previous `ui_locate` response; the hexadecimal value above is only a format example. The response includes new grounded coordinates, a current `layoutSignature`, and a `comparison` with `state` of `unchanged`, `moved`, `display_changed`, `layout_unknown` or `unavailable`. It always states `actionVerified:false` because comparison is **not** proof a human action succeeded. A missing previous layout signature returns `layout_unknown`, not a false assurance of stability.

If the display layout changes or the control moves, refresh the observation and decide whether to update a live scene. The runtime never automatically clicks or grants a permission. It will not silently animate an old target onto a new location without a grounded recheck.

No new model SDK or screenshot capture is required. Exact-match accessibility checks still need the user's opt-in and the operating system's permissions.
