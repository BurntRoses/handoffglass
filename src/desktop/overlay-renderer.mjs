/** Shared DOM/SVG renderer used by Electron and the read-only pattern gallery. */
const NS = 'http://www.w3.org/2000/svg';
function node(tag, attrs = {}) {
  const n = document.createElementNS(NS, tag);
  for (const [k,v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
}
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
// Repeatable ink wobble: never randomize grounded screen geometry.
function inkEllipse(x, y, rx, ry) {
  return `M ${x+rx+1} ${y} C ${x+rx+2} ${y+ry*.56} ${x+rx*.52} ${y+ry+1} ${x} ${y+ry} C ${x-rx*.55} ${y+ry-2} ${x-rx-1} ${y+ry*.45} ${x-rx} ${y} C ${x-rx+1} ${y-ry*.55} ${x-rx*.48} ${y-ry-1} ${x} ${y-ry} C ${x+rx*.52} ${y-ry+2} ${x+rx-2} ${y-ry*.5} ${x+rx+1} ${y} Z`;
}
function displayLabel(parent, label, x, y, width, height, accent) {
  if (!label || width < 150 || height < 85) return;
  const content = [...String(label)].slice(0, 48).join('');
  const units = [...content].reduce((sum, c) => sum + (/[^\u0000-\u00ff]/.test(c) ? 1.7 : 1), 0);
  const w = Math.min(width - 24, Math.max(110, units * 8 + 24));
  const left = clamp(x - w/2, 12, width - w - 12);
  const top = clamp(y < 90 ? y + 46 : y - 61, 12, height - 50);
  parent.append(node('rect', {x:left,y:top,width:w,height:36,rx:9,fill:'#13212c',stroke:accent,'stroke-opacity':.64,'stroke-width':1}));
  const t = node('text', {x:left + 12,y:top + 23,fill:'#f7fafc','font-size':13,'font-family':'system-ui, sans-serif','font-weight':650});
  t.textContent = content;
  parent.append(t);
}
/** Never reads or paints screenshots; the SVG window is mouse-through. */
export function renderOverlay(svg, input, viewport = {}) {
  const width = Math.max(1, viewport.width ?? window.innerWidth);
  const height = Math.max(1, viewport.height ?? window.innerHeight);
  svg.replaceChildren();
  svg.setAttribute('data-style', ['minimal','luminous','handdrawn'].includes(input?.visualStyle) ? input.visualStyle : 'luminous');
  svg.setAttribute('data-motion', ['off','gentle','expressive'].includes(input?.motion) ? input.motion : 'gentle');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  if (!Array.isArray(input?.annotations) || input.annotations.length === 0) return;
  const marks = input.annotations.filter(a => Number.isFinite(a.x) && Number.isFinite(a.y) && (a.opacity ?? 1) > 0);
  const spotlights = marks.filter(a => a.shape === 'spotlight');
  const defsRoot = node('defs');
  const glow = node('filter', { id:'hg-soft-glow',x:'-80%',y:'-80%',width:'260%',height:'260%' });
  glow.append(node('feGaussianBlur',{stdDeviation:5,result:'blur'}));
  const merge=node('feMerge');merge.append(node('feMergeNode',{in:'blur'}));merge.append(node('feMergeNode',{in:'SourceGraphic'}));glow.append(merge);
  defsRoot.append(glow); svg.append(defsRoot);
  if (spotlights.length) {
    const mask = node('mask', {id:'hg-spot-mask'});
    mask.append(node('rect', {x:0,y:0,width,height,fill:'white'}));
    for (const a of spotlights) mask.append(node('ellipse', {cx:a.x,cy:a.y,
      rx:(a.width ?? 112)/2 + 14,ry:(a.height ?? 56)/2 + 14,fill:'black'}));
    const defs = node('defs'); defs.append(mask); svg.append(defs);
    svg.append(node('rect', {width,height,fill:'rgba(7,13,23,.26)',mask:'url(#hg-spot-mask)'}));
  }
  for (const [index, a] of marks.entries()) {
    const x=a.x, y=a.y, rw=a.width ?? 112, rh=a.height ?? 56;
    const accent = /^#[a-f0-9]{6}$/i.test(a.color) ? a.color : '#50dbb4';
    const group = node('g', {opacity: clamp(a.opacity ?? 1, 0, 1), 'data-layer':String(a.layerId ?? 'legacy'), 'data-shape':String(a.shape),class:'hg-mark hg-mark-'+a.shape});
    const stroke = {stroke:accent,fill:'none','stroke-width':3.5,'stroke-linejoin':'round','stroke-linecap':'round'};
    if (a.shape === 'box') {
      group.append(node('rect', {x:x-rw/2-4,y:y-rh/2-4,width:rw+8,height:rh+8,rx:15,fill:accent,'fill-opacity':0.06}));
      group.append(node('rect', {x:x-rw/2,y:y-rh/2,width:rw,height:rh,rx:11,...stroke,class:'hg-trace'}));
    }
    else if (a.shape === 'ring' || a.shape === 'spotlight') {
      group.append(node('ellipse',{cx:x,cy:y,rx:rw/2+18,ry:rh/2+18,fill:accent,'fill-opacity':0.055,class:'hg-aura'}));
      const rx=rw/2 + (a.shape === 'spotlight' ? 13 : 0), ry=rh/2 + (a.shape === 'spotlight' ? 13 : 0);
      if (svg.getAttribute?.('data-style') === 'handdrawn' || input?.visualStyle === 'handdrawn')
        group.append(node('path',{d:inkEllipse(x,y,rx,ry),...stroke,class:'hg-trace'}));
      else group.append(node('ellipse', {cx:x,cy:y,rx,ry,...stroke,class:'hg-trace'}));
    }
    else if (a.shape === 'underline') group.append(node('line', {x1:x-rw/2,y1:y+rh/2+8,x2:x+rw/2,y2:y+rh/2+8,...stroke}));
    else if (a.shape === 'crosshair') {
      group.append(node('circle', {cx:x,cy:y,r:23,...stroke}));
      for (const [x1,y1,x2,y2] of [[x-39,y,x-28,y],[x+28,y,x+39,y],[x,y-39,x,y-28],[x,y+28,x,y+39]])
        group.append(node('line', {x1,y1,x2,y2,...stroke}));
    } else if (a.shape === 'badge') {
      const bx=x-rw/2-8, by=y-rh/2-8;
      group.append(node('circle', {cx:bx,cy:by,r:17,fill:'#14212d',stroke:accent,'stroke-width':2.8}));
      const t=node('text', {x:bx,y:by+5,'font-size':16,'font-weight':750,'text-anchor':'middle',fill:accent});
      t.textContent = String(a.label || '•').slice(0,3); group.append(t);
    } else if (a.shape === 'arrow') {
      const fx = clamp(x + (x > width-185 ? -112 : 112), 22, width-22);
      const fy = clamp(y + (y < 128 ? 92 : -92), 22, height-22);
      const id = `hg-arrow-${index}`;
      const marker = node('marker', {id,markerWidth:9,markerHeight:9,refX:8,refY:4.5,orient:'auto'});
      marker.append(node('path',{d:'M 0 0 L 9 4.5 L 0 9 z',fill:accent}));
      const defs=node('defs');defs.append(marker);group.append(defs);
      const controlX=fx+(x-fx)*0.38, controlY=fy+(y-fy)*0.11;
      group.append(node('path',{d:`M ${fx} ${fy} Q ${controlX} ${controlY} ${x} ${y}`,stroke:accent,fill:'none','stroke-width':4,'stroke-linecap':'round','marker-end':`url(#${id})`,class:'hg-trace hg-arrow-path'}));
      group.append(node('circle',{cx:x,cy:y,r:15,...stroke,class:'hg-pulse-ring'}));
      group.append(node('circle',{cx:x,cy:y,r:3.2,fill:accent}));
    }
    if (a.shape !== 'badge') displayLabel(group,a.label,x,y,width,height,accent);
    svg.append(group);
  }
}
