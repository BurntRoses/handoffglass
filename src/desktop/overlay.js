import { renderOverlay } from './overlay-renderer.mjs';
const svg = document.getElementById('canvas');
window.handoffglass?.onRender?.(snapshot => renderOverlay(svg, snapshot));
// Read-only gallery invocation uses the same production renderer, without Electron.
if (!window.handoffglass) window.HandoffGlassPreview = snapshot => renderOverlay(svg, snapshot);
