/** Shared, local SVG renderer. Geometry is grounded; all decorative motion stays local. */
const NS = 'http://www.w3.org/2000/svg';
const states = new WeakMap();
let nextSurface = 0;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const f = v => Math.round(v * 100) / 100;
function node(tag, attrs = {}) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
}
function styles(n, values) {
  for (const [k, v] of Object.entries(values)) n.style?.setProperty(k, String(v));
}
// A deterministic, open pen loop with an overlapping tail. Its center never wanders.
function inkLoop(x, y, rx, ry, second = false) {
  // Two different gestures, rather than a translated duplicate or random jitter.
  const points = second
    ? [[.65,-.82],[-.02,-1.15],[-1.07,-.7],[-.98,.2],[-.88,1.13],[.38,1.06],[.91,.49],[1.16,.12],[.98,-.67],[.41,-.99],[.18,-1.08],[-.04,-1.06],[-.17,-1.02]]
    : [[.88,-.46],[.4,-1.2],[-.9,-1.03],[-1,-.06],[-1.13,.86],[-.24,1.13],[.48,.88],[1.14,.63],[1.14,-.5],[.51,-.91],[.15,-1.05],[-.22,-1.04],[-.44,-.92]];
  const p = points.map(([xx, yy]) => `${f(x + rx * xx)} ${f(y + ry * yy)}`);
  return `M ${p[0]} C ${p.slice(1,4).join(' ')} C ${p.slice(4,7).join(' ')} C ${p.slice(7,10).join(' ')} C ${p.slice(10).join(' ')}`;
}
function trace(group, tag, attrs, extra = '') {
  const mark = node(tag, { ...attrs, pathLength: 1, class: `hg-trace ${extra}`.trim() });
  group.append(mark);
  if (group.getAttribute?.('data-effect') === 'flow') {
    group.append(node(tag, { ...attrs, fill: 'none', pathLength: 1, class: 'hg-flow', 'stroke-width': 3.4 }));
  }
  return mark;
}
function overlap(a, b) {
  return a.x < b.x + b.width + 8 && a.x + a.width + 8 > b.x && a.y < b.y + b.height + 6 && a.y + a.height + 6 > b.y;
}
function badgePosition(a, viewport) {
  return { x: clamp(a.x - (a.width ?? 112) / 2 - 12, 18, viewport.width - 18),
    y: clamp(a.y - (a.height ?? 56) / 2 - 12, 18, viewport.height - 18) };
}
function placeLabel(a, width, height, occupied) {
  let content = [...String(a.label || '')].slice(0, 48).join('');
  if (!content || a.shape === 'badge' || width < 180 || height < 100) return null;
  const units = [...content].reduce((n, c) => n + (/[^\u0000-\u00ff]/.test(c) ? 1.75 : 1), 0);
  const w = Math.min(width - 24, Math.max(72, units * 6.8 + 35)), h = 30;
  if (units * 6.8 + 35 > w) content = [...content].slice(0, Math.max(1, Math.floor((w - 45) / 12))).join('') + '…';
  const rw = a.width ?? 112, rh = a.height ?? 56;
  const choices = [
    { x: a.x - w / 2, y: a.y - rh / 2 - h - 24 },
    { x: a.x - w / 2, y: a.y + rh / 2 + 23 },
    { x: a.x + rw / 2 + 24, y: a.y - h / 2 },
    { x: a.x - rw / 2 - w - 24, y: a.y - h / 2 }
  ].map(b => ({ x: clamp(b.x, 12, width - w - 12), y: clamp(b.y, 12, height - h - 12), width: w, height: h }));
  const score = b => occupied.reduce((n, other) => n + (overlap(b, other) ? 1 : 0), 0);
  const box = choices.reduce((best, b) => score(b) < score(best) ? b : best);
  occupied.push(box);
  return { ...box, content };
}
function label(group, box, accent) {
  if (!box) return;
  const g = node('g', { class: 'hg-label' });
  g.append(node('rect', { x: box.x, y: box.y, width: box.width, height: box.height, rx: 10,
    fill: '#111d24', 'fill-opacity': .94, stroke: '#ffffff', 'stroke-opacity': .15, 'stroke-width': .8 }));
  g.append(node('circle', { cx: box.x + 13, cy: box.y + 15, r: 2.5, fill: accent }));
  const t = node('text', { x: box.x + 23, y: box.y + 19.5, fill: '#f4f8f6', 'font-size': 11.5,
    'font-family': '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif', 'font-weight': 550, 'letter-spacing': .15 });
  t.textContent = box.content;
  g.append(t); group.append(g);
}
function buildMark(a, accent, visualStyle, viewport, box) {
  const { x, y } = a, rw = a.width ?? 112, rh = a.height ?? 56;
  const ink = visualStyle === 'handdrawn' || a.shape === 'scribble';
  const effect = a.effect ?? (a.shape === 'halo' ? 'pulse' : 'draw');
  const group = node('g', { opacity: clamp(a.opacity ?? 1, 0, 1), class: `hg-mark hg-mark-${a.shape}`,
    'data-shape': a.shape, 'data-layer': a.layerId ?? 'legacy', 'data-effect': effect });
  const stroke = { stroke: accent, fill: 'none', 'stroke-width': ink ? 2.3 : 1.8,
    'stroke-linejoin': 'round', 'stroke-linecap': 'round' };
  const rect = { x: x - rw / 2 - 7, y: y - rh / 2 - 7, width: rw + 14, height: rh + 14, rx: Math.min(14, rh / 3 + 5) };
  if (a.shape === 'ring' || a.shape === 'scribble') {
    const rx = rw / 2 + 9, ry = rh / 2 + 9;
    if (ink) {
      trace(group, 'path', { d: inkLoop(x, y, rx, ry), ...stroke });
      trace(group, 'path', { d: inkLoop(x + 1.4, y + 1.1, rx + 2, ry + 1, true), ...stroke, 'stroke-width': 1, opacity: .48 }, 'hg-second-stroke');
    } else {
      trace(group, 'ellipse', { cx: x, cy: y, rx, ry, ...stroke });
      group.append(node('ellipse', { cx: x, cy: y, rx: rx + 5, ry: ry + 5, ...stroke, 'stroke-width': .6, opacity: .2, class: 'hg-aura' }));
    }
  } else if (a.shape === 'box' || a.shape === 'spotlight') {
    if (ink) {
      trace(group, 'path', { d: `M ${x - rw / 2 - 6} ${y - rh / 2 - 5} Q ${x} ${y - rh / 2 - 10} ${x + rw / 2 + 8} ${y - rh / 2 - 5} L ${x + rw / 2 + 6} ${y + rh / 2 + 7} Q ${x} ${y + rh / 2 + 10} ${x - rw / 2 - 7} ${y + rh / 2 + 5} Z`, ...stroke });
    } else {
      group.append(node('rect', { ...rect, fill: accent, 'fill-opacity': .035 }));
      trace(group, 'rect', { ...rect, ...stroke, 'stroke-opacity': .92 });
      if (a.shape === 'spotlight') group.append(node('rect', { ...rect, ...stroke, 'stroke-width': 7, opacity: .1, class: 'hg-edge-light' }));
    }
  } else if (a.shape === 'arrow') {
    const side = x > viewport.width - 210 ? -1 : 1, vertical = y < 155 ? 1 : -1;
    const sx = clamp(x + side * (rw / 2 + 82), 24, viewport.width - 24);
    const sy = clamp(y + vertical * (rh / 2 + 66), 24, viewport.height - 24);
    const ex = x + side * Math.min(12, rw / 4), ey = y + vertical * Math.min(10, rh / 4);
    const cx = sx + (ex - sx) * .1, cy = ey - vertical * 18;
    trace(group, 'path', { d: `M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`, ...stroke, 'stroke-width': ink ? 3 : 2.4 });
    const angle = Math.atan2(ey - cy, ex - cx), size = 10;
    trace(group, 'path', { d: `M ${f(ex - Math.cos(angle - .55) * size)} ${f(ey - Math.sin(angle - .55) * size)} L ${ex} ${ey} L ${f(ex - Math.cos(angle + .55) * size)} ${f(ey - Math.sin(angle + .55) * size)}`, ...stroke }, 'hg-arrow-head');
    group.append(node('circle', { cx: x, cy: y, r: 3, fill: accent, class: 'hg-target-dot' }));
  } else if (a.shape === 'underline') {
    const yy = y + rh / 2 + 8;
    trace(group, 'path', { d: `M ${x - rw / 2} ${yy + 1} Q ${x - rw / 8} ${yy + (ink ? -4 : -1)} ${x + rw / 2} ${yy - 1}`, ...stroke, 'stroke-width': ink ? 3.6 : 2.8 });
    trace(group, 'path', { d: `M ${x - rw / 2 + 7} ${yy + 5} Q ${x + rw / 5} ${yy + 2} ${x + rw / 2 - 11} ${yy + 5}`, ...stroke, 'stroke-width': 1, opacity: .35 }, 'hg-second-stroke');
  } else if (a.shape === 'highlight') {
    const left = x - rw / 2, right = x + rw / 2, thickness = Math.max(8, rh * .72);
    trace(group, 'path', { d: `M ${left} ${y + 1} Q ${x} ${y - 2} ${right} ${y - 1}`, ...stroke,
      'stroke-width': thickness, 'stroke-linecap': 'butt', opacity: .25 }, 'hg-marker-ink');
    trace(group, 'path', { d: `M ${left + 3} ${y + rh * .28} Q ${x} ${y + rh * .24} ${right - 4} ${y + rh * .28}`,
      ...stroke, 'stroke-width': Math.max(3, rh * .2), opacity: .1 }, 'hg-second-stroke');
  } else if (a.shape === 'bracket') {
    const l = rect.x, t = rect.y, r = l + rect.width, b = t + rect.height, len = Math.min(20, rw / 4, rh / 2 + 5);
    for (const [xx, yy, dx, dy] of [[l, t, 1, 1], [r, t, -1, 1], [r, b, -1, -1], [l, b, 1, -1]])
      trace(group, 'path', { d: `M ${xx} ${yy + dy * len} L ${xx} ${yy + dy * 5} Q ${xx} ${yy} ${xx + dx * 5} ${yy} L ${xx + dx * len} ${yy}`, ...stroke });
  } else if (a.shape === 'check') {
    const s = Math.min(24, rw / 2, rh / 2 + 5);
    group.append(node('circle', { cx: x, cy: y, r: s + 12, fill: '#10271e', 'fill-opacity': .9, stroke: accent, 'stroke-opacity': .3 }));
    trace(group, 'path', { d: `M ${x - s * .6} ${y} L ${x - s * .12} ${y + s * .46} L ${x + s * .72} ${y - s * .55}`, ...stroke, 'stroke-width': 3.2 });
  } else if (a.shape === 'crosshair') {
    const rx = rw / 2 + 8, ry = rh / 2 + 8;
    for (const [x1, y1, x2, y2] of [[x - rx - 7, y, x - rx + 7, y], [x + rx - 7, y, x + rx + 7, y], [x, y - ry - 7, x, y - ry + 7], [x, y + ry - 7, x, y + ry + 7]])
      trace(group, 'line', { x1, y1, x2, y2, ...stroke, 'stroke-width': 1.4 });
    group.append(node('circle', { cx: x, cy: y, r: 3, ...stroke, 'stroke-width': 1.2 }));
  } else if (a.shape === 'halo') {
    const r = Math.max(18, Math.min(rw, rh) / 2 + 4);
    group.append(node('circle', { cx: x, cy: y, r, ...stroke, class: 'hg-beacon', opacity: .5 }));
    group.append(node('circle', { cx: x, cy: y, r: r + 10, ...stroke, class: 'hg-beacon hg-beacon-outer', opacity: .2 }));
    group.append(node('circle', { cx: x, cy: y, r: 4, fill: accent }));
  } else if (a.shape === 'cursor') {
    trace(group, 'path', { d: `M ${x} ${y} L ${x + 4} ${y + 29} L ${x + 11} ${y + 21} L ${x + 17} ${y + 33} L ${x + 23} ${y + 30} L ${x + 17} ${y + 18} L ${x + 28} ${y + 17} Z`, ...stroke,
      fill: '#11231e', 'fill-opacity': .95, 'stroke-width': 1.8 });
    group.append(node('circle', { cx: x, cy: y, r: 8, ...stroke, 'stroke-width': 1, opacity: .5, class: 'hg-aura' }));
  } else if (a.shape === 'badge') {
    const {x:bx, y:by} = badgePosition(a, viewport);
    group.append(node('circle', { cx: bx, cy: by, r: 13, fill: '#14251f', stroke: accent, 'stroke-width': 1.4 }));
    const t = node('text', { x: bx, y: by + 4.2, 'font-size': 11.5, 'font-weight': 650, 'font-family': 'system-ui,sans-serif', 'text-anchor': 'middle', fill: accent });
    t.textContent = [...String(a.label || '•')].slice(0, 3).join(''); group.append(t);
  }
  label(group, box, accent);
  return group;
}
function syncChildren(parent, wanted) {
  // Preserve unchanged SVG nodes: snapshot polls must not restart CSS animations.
  for (const old of Array.from(parent.children)) if (!wanted.includes(old)) old.remove();
  wanted.forEach((n, i) => { if (parent.children[i] !== n) parent.insertBefore(n, parent.children[i] || null); });
}
/** UI snapshots are repeatable. Moving targets retain their original drawing clock. */
export function renderOverlay(svg, input, viewport = {}) {
  const width = Math.max(1, viewport.width ?? window.innerWidth), height = Math.max(1, viewport.height ?? window.innerHeight);
  const visualStyle = ['minimal', 'luminous', 'handdrawn'].includes(input?.visualStyle) ? input.visualStyle : 'luminous';
  const motion = ['off', 'gentle', 'expressive'].includes(input?.motion) ? input.motion : 'gentle';
  svg.setAttribute('data-style', visualStyle); svg.setAttribute('data-motion', motion);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const marks = (Array.isArray(input?.annotations) ? input.annotations : []).filter(a => Number.isFinite(a.x) && Number.isFinite(a.y) && (a.opacity ?? 1) > 0);
  if (!marks.length) { svg.replaceChildren(); states.delete(svg); return; }
  const session = input?.sessionId ?? input?.id ?? 'preview';
  let state = states.get(svg);
  if (!state || state.session !== session) { state = { session, uid: `hg-${++nextSurface}`, marks: new Map() }; states.set(svg, state); }
  const now = performance.now(), wanted = [], next = new Map();
  const defs = node('defs');
  const glow = node('filter', { id: `${state.uid}-glow`, x: '-35%', y: '-60%', width: '170%', height: '220%' });
  glow.append(node('feGaussianBlur', { stdDeviation: 2.2 })); defs.append(glow);
  const feather = node('filter', { id: `${state.uid}-feather`, x: '-20%', y: '-40%', width: '140%', height: '180%' });
  feather.append(node('feGaussianBlur', { stdDeviation: 4 })); defs.append(feather);
  const spots = marks.filter(a => a.shape === 'spotlight');
  if (spots.length) {
    const mask = node('mask', { id: `${state.uid}-mask`, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width, height });
    mask.append(node('rect', { x: 0, y: 0, width, height, fill: 'white' }));
    for (const a of spots) mask.append(node('rect', { x: a.x - (a.width ?? 112) / 2 - 12,
      y: a.y - (a.height ?? 56) / 2 - 12, width: (a.width ?? 112) + 24, height: (a.height ?? 56) + 24,
      rx: 18, fill: 'black', filter: `url(#${state.uid}-feather)`, opacity: a.opacity ?? 1 }));
    defs.append(mask);
  }
  wanted.push(defs);
  if (spots.length) wanted.push(state.veil ??= node('rect', { x: 0, y: 0, width, height, fill: '#07131c', 'fill-opacity': .32, mask: `url(#${state.uid}-mask)`, class: 'hg-veil' }));
  if (state.veil) { state.veil.setAttribute('width', width); state.veil.setAttribute('height', height); }
  if (!spots.length) state.veil = null;
  const occupied = marks.map(a => {
    if (a.shape === 'badge') { const p = badgePosition(a, {width, height}); return {x:p.x-15,y:p.y-15,width:30,height:30}; }
    return { x: a.x - (a.width ?? 112) / 2 - 10, y: a.y - (a.height ?? 56) / 2 - 10,
      width: (a.width ?? 112) + 20, height: (a.height ?? 56) + 20 };
  });
  for (const [i, a] of marks.entries()) {
    const key = `${a.layerId ?? 'legacy'}:${a.id ?? i}:${a.shape}`;
    const box = placeLabel(a, width, height, occupied);
    const accent = /^#[a-f0-9]{6}$/i.test(a.color) ? a.color : '#79efbd';
    const fingerprint = JSON.stringify([a, box, visualStyle, width, height]);
    const old = state.marks.get(key);
    const start = old?.start ?? now;
    let group = old?.fingerprint === fingerprint ? old.group : null;
    if (!group) {
      group = buildMark(a, accent, visualStyle, { width, height }, box);
      for (const edge of group.querySelectorAll('.hg-edge-light')) edge.setAttribute('filter', `url(#${state.uid}-glow)`);
      const elapsed = now - start;
      styles(group, { '--hg-opacity': clamp(a.opacity ?? 1, 0, 1), '--hg-delay': `${(a.delayMs ?? 0) - elapsed}ms`,
        '--hg-duration': `${a.durationMs ?? (visualStyle === 'handdrawn' ? 1050 : 760)}ms` });
    }
    next.set(key, { fingerprint, group, start }); wanted.push(group);
  }
  syncChildren(svg, wanted); state.marks = next;
}
