'use strict';
const svg = document.getElementById('canvas');
const ns = 'http://www.w3.org/2000/svg';
function el(name, attributes = {}) {
  const node = document.createElementNS(ns, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}
function textAt(message, x, y, color, w, h) {
  if (!message) return;
  const content = message.length > 48 ? message.slice(0, 47) + '…' : message;
  const width = Math.min(w - 24, Math.max(108, content.length * (/[\u4e00-\u9fa5]/.test(content) ? 13 : 8) + 24));
  if (width < 80) return;
  const px = Math.max(12, Math.min(w - width - 12, x - width / 2));
  const py = Math.max(12, Math.min(h - 48, y < 88 ? y + 48 : y - 58));
  const label = el('rect', { x: px, y: py, width, height: 38, rx: 10, class: 'label-bg' });
  const line = el('text', { x: px + 12, y: py + 24, class: 'label-text' });
  line.textContent = content;
  svg.append(label, line);
}
function render(input) {
  svg.replaceChildren();
  if (!input || !Array.isArray(input.annotations)) return;
  const w = window.innerWidth, h = window.innerHeight;
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  for (const [index, item] of input.annotations.entries()) {
    const { x, y } = item;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const color = /^#[a-f\d]{6}$/i.test(item.color) ? item.color : '#50dbb4';
    const rw = item.width ?? 116, rh = item.height ?? 60;
    const defs = el('defs');
    const markerId = `tip-${index}`;
    const marker = el('marker', { id: markerId, markerWidth: 10, markerHeight: 10, refX: 8, refY: 5, orient: 'auto' });
    marker.append(el('path', { d: 'M 1 1 L 9 5 L 1 9 z', fill: color }));
    defs.append(marker);
    svg.append(defs);
    if (item.shape === 'spotlight') {
      const maskId = `mask-${index}`;
      const mask = el('mask', { id: maskId });
      mask.append(el('rect', { width: w, height: h, fill: 'white' }));
      mask.append(el('ellipse', { cx: x, cy: y, rx: rw / 2 + 12, ry: rh / 2 + 12, fill: 'black' }));
      const maskDefs = el('defs'); maskDefs.append(mask); svg.append(maskDefs);
      svg.append(el('rect', { width: w, height: h, fill: 'rgba(0,0,0,.22)', mask: `url(#${maskId})` }));
      svg.append(el('ellipse', { cx: x, cy: y, rx: rw / 2 + 12, ry: rh / 2 + 12, stroke: color, class: 'halo' }));
    } else if (item.shape === 'box') {
      svg.append(el('rect', { x: x - rw / 2, y: y - rh / 2, width: rw, height: rh, rx: 12, stroke: color, class: 'halo' }));
    } else if (item.shape === 'ring') {
      svg.append(el('ellipse', { cx: x, cy: y, rx: rw / 2, ry: rh / 2, stroke: color, class: 'halo' }));
    } else {
      const fromX = Math.max(28, Math.min(w - 28, x + (x > w - 200 ? -115 : 115)));
      const fromY = Math.max(28, Math.min(h - 28, y + (y < 130 ? 95 : -95)));
      svg.append(el('line', { x1: fromX, y1: fromY, x2: x, y2: y, stroke: color,
        class: 'guideline', 'marker-end': `url(#${markerId})` }));
      svg.append(el('circle', { cx: x, cy: y, r: 17, stroke: color, class: 'halo' }));
    }
    textAt(item.label, x, y, color, w, h);
  }
}
window.handoffglass.onRender(render);
