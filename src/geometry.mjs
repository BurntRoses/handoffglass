/** Electron screen and BrowserWindow coordinates are device-independent pixels. */
export function validDisplay(display) {
  return display && typeof display.id === 'string' &&
    [display.x, display.y, display.width, display.height].every(Number.isFinite) &&
    display.width > 0 && display.height > 0 && display.width <= 20000 && display.height <= 20000;
}
export function contains(display, annotation) {
  return annotation.x >= display.x && annotation.x < display.x + display.width &&
    annotation.y >= display.y && annotation.y < display.y + display.height;
}
export function localAnnotations(display, annotations) {
  return annotations.filter(a => contains(display, a)).map(a => ({
    ...a, x: a.x - display.x, y: a.y - display.y
  }));
}
export function canLocateAll(displays, annotations) {
  return annotations.every(a => displays.some(d => contains(d, a)));
}
