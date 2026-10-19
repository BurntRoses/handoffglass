# HandoffGlass visual language / 可视化标注设计规范

This is a **production design contract**, not a mock. The gallery loads the production SVG renderer directly (`src/desktop/overlay-renderer.mjs`). Only the coordinates are simulated.

## Foundations

- Prefer **one clear mark per decision**. Never suggest that the user must approve a permission, purchase, login, or security prompt.
- Default state is ephemeral, click-through and never steals keyboard focus. The independently clickable handoff panel communicates decisions.
- Every visual mark must have **grounded global DIP coordinates**. If the location is unknown, use coordinate-free `handoff_request`, not an imagined marker.
- Explain the action in plain language; a marker does not replace a human-readable description or informed decision.
- Semantic color is contextual, not a claim that an action is safe; `success` means a *visual emphasis*, never verification of an external result.

## Semantic palette (code in `src/visual/scene.mjs`)

| Token | Hex | Meaning |
| --- | --- | --- |
| `accent` | `#50DBB4` | Focus, default guidance |
| `info` | `#75B9FF` | Navigation, explanation |
| `success` | `#5BD5A0` | Visually highlight something to check |
| `caution` | `#FFC16E` | Privileged or consequential user choice |
| `danger` | `#FF8585` | Dangerous or destructive action (not an approval recommendation) |
| `neutral` | `#D1D9E5` | Alternative action / supporting context |

Colors are validated as 6-digit hexadecimal and never interpolated into HTML. Text is rendered using `textContent`. Prefer text + shape redundancy for color-vision accessibility. No display-capture, PII, remote font or telemetry dependencies.

## Primitive marks (13)

| Shape | Intended use | Rendering behavior |
| --- | --- | --- |
| `arrow` | Indicates a target and direction | Curved open arrow, delayed head, small target dot |
| `ring` | Precisely marks a button or icon | Hollow elliptical contour |
| `box` | Locates a bounded control group | Rounded outlined rectangle |
| `spotlight` | Emphasizes area by dimming surroundings | Single shared SVG mask (does not stack darkness) |
| `badge` | Ordered step/caution identifier | Small numbered circular chip outside target |
| `underline` | Marks a row, heading or text field | Two different curved strokes |
| `crosshair` | Re-check exact target / completion observation | Hollow circle with four short rays |
| `highlight` | Read a short piece of text | Translucent broad marker stroke |
| `bracket` | Frame a region with little obstruction | Four rounded corners |
| `check` | Visually mark a point to review | Drawn check glyph; never proof of completion |
| `scribble` | Human ink emphasis | Two open, overlapping pen gestures |
| `halo` | Attention at a point | Local breathing/ripple rings |
| `cursor` | Demonstrate a location | Vector pointer; does not move the real cursor |

## Reusable templates (9)

| Template | Purpose | Composition |
| --- | --- | --- |
| `focus` | Focus attention | Spotlight ring + shared dimming |
| `point` | Which control? | Arrow + label |
| `inspect` | Where to read? | Rounded box + label |
| `caution` | Consequential user choice | Caution box + caution badge |
| `sequence` | Ordered multi-step guidance | Rings (corners for wide rows) + numbered badges |
| `verify` | Check a target after a human action | Crosshair + label; **not automatic verification** |
| `sketch` | Personal ink emphasis | Double pen loop, 1100 ms reveal |
| `highlight` | Read a measured text area | Caution marker stroke, 850 ms reveal |
| `bracket` | Keep central content readable | Corner frame with gentle emphasis |

Templates are programs rather than SVG files: `composeTemplate(name, groundedTargets)` returns an editable Scene v1 with stable layer and mark IDs. All templates share the same renderer.

## Layers and rendering

- Layers sorted by `(zIndex, insertion order)`; `zIndex` is an integer from `-100` to `100`.
- A layer may contain 0–24 marks; a whole scene can have **12 layers / 24 marks total**. Hidden marks count toward the limit to prevent hiding unbounded payloads.
- Each layer has `id`, `visible`, `opacity`, `zIndex` and `annotations`. Layer IDs must be stable across incremental updates.
- Effective opacity is `layer.opacity × mark.opacity`; `visible=false` suppresses rendering without deleting the mark.
- SVG spotlight masking is drawn first; annotation contours and labels follow layer order. This means spotlight holes are always shared, even if multiple layers contain spotlights.
- Labels use bounded system-font width estimates, clamp to the viewport and score four candidate positions against targets and earlier labels. Dense layouts may still overlap; keep instructions short.
- Overlay always pointer-through; separate human response panel is interactive. Desktop limitations (secure UAC, Spaces, protected prompts) still apply.

## Layout & typography

- Annotation stroke: typically 1.8–2.3 device-independent px with rounded ends.
- Caption: compact system UI font (11.5px), dark backed label, at most 48 visible Unicode code points; not intended for paragraphs.
- Explain longer guidance through the panel message (up to 1000 chars), not over target buttons.
- CJK text: no font downloads; use system fallback. Maintain contrast when testing light/dark applications.
- Respect reduced-motion preference. Use local draw, pulse or flow sparingly; see [motion semantics](VISUAL_MOTION.md). Animation never changes target geometry or completion state.

## Preview

Run `npm run gallery`, open the printed loopback URL and compare thirteen marks, three styles, four effects and staggered sequences. Individual specimen tiles scope their spotlight to the tile; exported scenes use the normal shared desktop mask. This gallery intentionally uses the same renderer as Electron. It does **not** imply that real desktop click-through and multi-monitor behavior are already validated.

### Native Electron packaging detail

The gallery imports the canonical ES module `src/desktop/overlay-renderer.mjs`. To avoid `file://` ES-module CORS issues when Electron loads its native overlay, `npm run build:overlay` deterministically generates the classic, no-import `src/desktop/overlay.js` from that **same** renderer. `npm run verify` checks that the generated bundle has not drifted. No webpack/Vite/esbuild or extra runtime dependency is needed.
