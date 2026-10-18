/** Model-independent, renderer-independent HandoffGlass scene protocol v1.
 * No I/O, browser globals, third-party dependencies or mutable singleton state.
 */
export const SCENE_VERSION = 1;
export const MAX_LAYERS = 12;
export const MAX_MARKS = 24;
export const SHAPES = Object.freeze(['arrow', 'ring', 'box', 'spotlight', 'badge', 'underline', 'crosshair']);
export const TONES = Object.freeze({
  accent: '#50dbb4', info: '#75b9ff', success: '#5bd5a0',
  caution: '#ffc16e', danger: '#ff8585', neutral: '#d1d9e5'
});
export const TEMPLATE_NAMES = Object.freeze(['focus', 'point', 'inspect', 'caution', 'sequence', 'verify']);
const HEX = /^#[0-9a-fA-F]{6}$/;
const ID = /^[A-Za-z][A-Za-z0-9_-]{0,47}$/;
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const cap = (v, n) => typeof v === 'string' ? v.trim().slice(0, n) : '';
function number(v, key, min, max) {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw new TypeError(`${key} must be a finite global DIP coordinate or property within [${min}, ${max}]`);
  return v;
}
function identifier(v, key) {
  if (typeof v !== 'string' || !ID.test(v)) throw new TypeError(`Invalid ${key}; use ASCII letters, digits, underscore or hyphen (max 48)`);
  return v;
}
export function normalizeAnnotation(input) {
  if (!object(input)) throw new TypeError('Annotation must be an object');
  const shape = input.shape ?? 'arrow';
  if (!SHAPES.includes(shape)) throw new TypeError('Unknown annotation shape');
  const tone = input.tone ?? 'accent';
  if (!Object.hasOwn(TONES, tone)) throw new TypeError('Unknown annotation tone');
  const color = input.color ?? TONES[tone];
  if (typeof color !== 'string' || !HEX.test(color)) throw new TypeError('Color must be a six-digit hex color');
  const result = {
    x: number(input.x, 'x', -100000, 100000), y: number(input.y, 'y', -100000, 100000),
    shape, color,
    width: input.width == null ? null : number(input.width, 'width', Number.EPSILON, 5000),
    height: input.height == null ? null : number(input.height, 'height', Number.EPSILON, 5000),
    label: cap(input.label, 64)
  };
  if (input.id !== undefined) result.id = identifier(input.id, 'annotation id');
  if (input.tone !== undefined) result.tone = tone;
  if (input.opacity !== undefined) result.opacity = number(input.opacity, 'opacity', 0, 1);
  return result;
}
function normalizeLayer(layer) {
  if (!object(layer)) throw new TypeError('Layer must be an object');
  const id = identifier(layer.id, 'layer id');
  const marks = layer.annotations ?? [];
  if (!Array.isArray(marks)) throw new TypeError('Layer annotations must be an array');
  const annotations = marks.map(normalizeAnnotation);
  const seen = new Set();
  for (const [idx, mark] of annotations.entries()) {
    if (!mark.id) mark.id = `mark_${idx + 1}`;
    if (seen.has(mark.id)) throw new TypeError(`Duplicate annotation id: ${mark.id}`);
    seen.add(mark.id);
  }
  const zIndex = layer.zIndex ?? 0;
  if (!Number.isInteger(zIndex) || zIndex < -100 || zIndex > 100) throw new TypeError('Layer zIndex must be integer [-100, 100]');
  if (layer.visible !== undefined && typeof layer.visible !== 'boolean') throw new TypeError('Layer visible must be boolean');
  return { id, zIndex, visible: layer.visible ?? true,
    opacity: layer.opacity === undefined ? 1 : number(layer.opacity, 'layer opacity', 0, 1), annotations };
}
export function normalizeScene(input) {
  if (!object(input) || input.version !== SCENE_VERSION || !Array.isArray(input.layers)) {
    throw new TypeError('Scene must include version: 1 and layers: []');
  }
  if (input.layers.length > MAX_LAYERS) throw new TypeError(`Scene can have at most ${MAX_LAYERS} layers`);
  const layers = input.layers.map(normalizeLayer);
  const ids = layers.map(l => l.id);
  if (new Set(ids).size !== ids.length) throw new TypeError('Duplicate layer id');
  if (layers.reduce((n, l) => n + l.annotations.length, 0) > MAX_MARKS) {
    throw new TypeError(`Scene can have at most ${MAX_MARKS} annotations, including hidden layers`);
  }
  return { version: SCENE_VERSION, layers };
}
export function flattenScene(input) {
  const scene = normalizeScene(input);
  return scene.layers.map((layer, i) => ({...layer, index:i}))
    .filter(layer => layer.visible && layer.opacity > 0)
    .sort((a,b) => a.zIndex-b.zIndex || a.index-b.index)
    .flatMap(layer => layer.annotations.filter(mark => (mark.opacity ?? 1) > 0).map(mark => ({
      ...mark, layerId: layer.id, zIndex: layer.zIndex,
      opacity: Number((layer.opacity * (mark.opacity ?? 1)).toFixed(3))
    })));
}
/** All operations are validated against a private copy and applied atomically. */
export function patchScene(input, operations) {
  const scene = normalizeScene(input);
  if (!Array.isArray(operations) || operations.length === 0 || operations.length > 16) {
    throw new TypeError('Scene patch requires 1–16 operations');
  }
  for (const op of operations) {
    if (!object(op)) throw new TypeError('Invalid scene operation');
    if (op.op === 'upsert_layer') {
      const layer = normalizeLayer(op.layer);
      const i = scene.layers.findIndex(l => l.id === layer.id);
      if (i === -1) scene.layers.push(layer); else scene.layers[i] = layer;
    } else if (op.op === 'remove_layer') {
      identifier(op.layerId, 'layer id');
      const i = scene.layers.findIndex(l => l.id === op.layerId);
      if (i < 0) throw new TypeError('Layer not found');
      scene.layers.splice(i, 1);
    } else if (op.op === 'set_layer') {
      const layer = scene.layers.find(l => l.id === identifier(op.layerId, 'layer id'));
      if (!layer) throw new TypeError('Layer not found');
      if (op.visible === undefined && op.opacity === undefined && op.zIndex === undefined) throw new TypeError('set_layer requires a property');
      Object.assign(layer, normalizeLayer({ ...layer, ...('visible' in op ? {visible:op.visible} : {}),
        ...('opacity' in op ? {opacity:op.opacity} : {}), ...('zIndex' in op ? {zIndex:op.zIndex} : {}) }));
    } else if (op.op === 'upsert_annotation') {
      const layer = scene.layers.find(l => l.id === identifier(op.layerId, 'layer id'));
      if (!layer) throw new TypeError('Layer not found');
      const mark = normalizeAnnotation(op.annotation);
      if (!mark.id) throw new TypeError('upsert_annotation requires stable annotation id');
      const i = layer.annotations.findIndex(a => a.id === mark.id);
      if (i < 0) layer.annotations.push(mark); else layer.annotations[i] = mark;
    } else if (op.op === 'remove_annotation') {
      const layer = scene.layers.find(l => l.id === identifier(op.layerId, 'layer id'));
      if (!layer) throw new TypeError('Layer not found');
      const i = layer.annotations.findIndex(a => a.id === identifier(op.annotationId, 'annotation id'));
      if (i < 0) throw new TypeError('Annotation not found');
      layer.annotations.splice(i, 1);
    } else throw new TypeError('Unknown scene operation');
  }
  return normalizeScene(scene);
}
/** Opinionated reusable annotation patterns; actual targets MUST already be grounded in global DIP. */
export function composeTemplate(name, targets) {
  if (!TEMPLATE_NAMES.includes(name)) throw new TypeError('Unknown visual template');
  if (!Array.isArray(targets) || !targets.length || targets.length > 8) throw new TypeError('Template requires 1–8 grounded targets');
  const marks = targets.map(normalizeAnnotation);
  const primary = [], supporting = [];
  for (const [i, t] of marks.entries()) {
    const base = { x:t.x, y:t.y, width:t.width, height:t.height, label:t.label, id:`primary_${i+1}` };
    if (name === 'focus') {
      primary.push({ ...base, shape:'spotlight', tone:'accent' });
    } else if (name === 'point') {
      primary.push({ ...base, shape:'arrow', tone:'info' });
    } else if (name === 'inspect') {
      primary.push({ ...base, shape:'box', tone:'neutral' });
    } else if (name === 'caution') {
      primary.push({ ...base, shape:'box', tone:'caution' });
      supporting.push({x:t.x,y:t.y, shape:'badge', tone:'caution', id:`badge_${i+1}`, label:'!'});
    } else if (name === 'sequence') {
      primary.push({ ...base, shape:'ring', tone:'info', label:'' });
      supporting.push({x:t.x,y:t.y, shape:'badge', tone:'info', id:`badge_${i+1}`, label:String(i+1)});
    } else if (name === 'verify') {
      primary.push({ ...base, shape:'crosshair', tone:'success' });
    }
  }
  return normalizeScene({ version:1, layers: [
    {id:'targets', zIndex:10, annotations:primary},
    {id:'badges', zIndex:20, annotations:supporting}
  ] });
}
