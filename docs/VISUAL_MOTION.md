# HandoffGlass visual motion system (v0.7)

## Visual personality

Refined, accessible, low-interruption guidance: translucent graphite, muted teal/cyan, wide soft highlights, polished purposeful motion. Critical permission decisions must remain legible; animations never obscure or replace native permission text.

## Production source of truth

- `src/desktop/overlay-renderer.mjs` generates the SVG annotations used by both Electron and the gallery.
- `src/desktop/overlay.css` owns motion tokens and user/OS reduced-motion semantics.
- `src/desktop/panel.css` owns decision surface; the panel's native buttons are always interactive and explicit.
- `src/local/preferences.mjs` owns local, user-approved style settings; no model SDK gets to persist them.

## Modes

| `visualStyle` | Intended behavior |
| --- | --- |
| `minimal` | Flat crisp edges, no decorative auras |
| `luminous` | Tinted halos, light-traced bezier arrows, glass-inspired labels |
| `handdrawn` | Stroke reveal with deliberately imperfect dashed ink texture; never deliberately misaligns the target |

| `motion` | Behavior |
| --- | --- |
| `off` | Immediate fully visible geometry, no transitions |
| `gentle` | Slow low-amplitude breathing plus one reveal |
| `expressive` | Slightly extended entrance; still static afterwards except soft aura |

OS `prefers-reduced-motion:reduce` disables effects even if an Agent requests `expressive`. A single SVG mask creates multi-spotlight dimming rather than repeatedly stacking transparent rectangles. High-risk guidance uses caution coloring rather than a gamified reward animation.

## Renderer verification

No screenshot is generated/stored. Unit tests use a fake DOM to assert valid SVG shapes and textContent-only text, and inspect CSS for reduced-motion. Actual blur/glow/performance must be profiled on Windows/macOS hardware (Issue #1). Avoid per-frame model calls: frame interpolation is CSS/SVG local.
