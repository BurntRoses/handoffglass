import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { renderOverlay } from '../src/desktop/overlay-renderer.mjs';
import { SHAPES, TONES, normalizeScene, flattenScene } from '../src/visual/scene.mjs';
import { SvgNode, walk, documentStub } from './helpers/svg-dom.mjs';
const orig=globalThis.document;
globalThis.document=documentStub;
test('production SVG renderer supports all shapes without Electron or network',()=>{
  const svg=new SvgNode('svg');
  const shapes=SHAPES.map((shape,i)=>({id:`mark_${i}`,shape,x:100+i*50,y:250,color:TONES.info,label:'目标 <script> 你好',opacity:.8}));
  renderOverlay(svg,{annotations:shapes},{width:960,height:600});
  assert.equal(walk(svg,x=>(x.attrs.class||'').split(' ').includes('hg-mark')).length,SHAPES.length);
  assert.ok(walk(svg,x=>x.tag==='ellipse').length>=2);
  assert.ok(walk(svg,x=>x.tag==='line').length>=3);
  assert.equal(walk(svg,x=>x.tag==='script').length,0);
  assert.equal(walk(svg,x=>x.tag==='text').some(x=>x.textContent.includes('<script>')),true);
  assert.equal(svg.attrs.viewBox,'0 0 960 600');
});
test('multiple spotlights share a single dimming mask rather than stacking dark rectangles',()=>{
  const svg=new SvgNode('svg');
  renderOverlay(svg,{annotations:[{shape:'spotlight',x:120,y:120},{shape:'spotlight',x:340,y:120}]},{width:640,height:360});
  assert.equal(walk(svg,x=>x.tag==='mask').length,1);
  assert.equal(walk(svg,x=>x.tag==='rect'&&x.attrs.class==='hg-veil').length,1);
  assert.equal(walk(svg,x=>x.tag==='rect'&&x.attrs.fill==='black').length,2);
  renderOverlay(svg,{annotations:[]},{width:640,height:360});
  assert.equal(svg.children.length,0);
});
test('documented sample scenes load and shared palette/schema stay in sync',async()=>{
  const schema=JSON.parse(await readFile(fileURLToPath(new URL('../schemas/scene-v1.schema.json',import.meta.url)),'utf8'));
  assert.deepEqual(schema.$defs.annotation.properties.shape.enum,SHAPES);
  assert.deepEqual(schema.$defs.annotation.properties.tone.enum,Object.keys(TONES));
  for(const filename of ['access-review','tutorial','multi-monitor']){
    const data=JSON.parse(await readFile(fileURLToPath(new URL(`../examples/scenes/${filename}.json`,import.meta.url)),'utf8'));
    const scene=normalizeScene(data);
    assert.equal(scene.version,1);
    assert.ok(flattenScene(scene).length>0);
  }
});
test.after(()=>{globalThis.document=orig});

test('normalized path progress, unique masks and different ink strokes are local to each SVG',()=>{
  const surfaces=[new SvgNode('svg'),new SvgNode('svg')];
  for(const svg of surfaces)renderOverlay(svg,{visualStyle:'handdrawn',annotations:[
    {id:'ink',shape:'scribble',x:200,y:180},{id:'spot',shape:'spotlight',x:420,y:180}
  ]},{width:640,height:400});
  const ids=surfaces.flatMap(svg=>walk(svg,n=>n.attrs.id).map(n=>n.attrs.id));
  assert.equal(new Set(ids).size,ids.length,'SVG resource ids must not collide between previews');
  const paths=walk(surfaces[0],n=>n.tag==='path');
  assert.equal(paths.every(n=>n.attrs.pathLength==='1'),true);
  assert.notEqual(paths[0].attrs.d,paths[1].attrs.d);
  assert.equal(walk(surfaces[0],n=>n.tag==='feGaussianBlur'&&n.attrs.stdDeviation==='4').length,1);
});

test('polls preserve nodes; moving marks retain their clock; lost marks restart on restoration',async()=>{
  const svg=new SvgNode('svg'),a={id:'target',shape:'ring',x:300,y:200,label:'Open project',opacity:.4};
  const draw=annotations=>renderOverlay(svg,{sessionId:'same',annotations},{width:800,height:500});
  const mark=()=>walk(svg,n=>n.attrs['data-shape']==='ring')[0];
  draw([a]); const first=mark(); draw([a]); assert.equal(mark(),first);
  assert.equal(first.style.getPropertyValue('--hg-opacity'),'0.4');
  await new Promise(r=>setTimeout(r,20));
  draw([{...a,x:310}]); const moved=mark(); assert.notEqual(moved,first);
  assert.ok(parseFloat(moved.style.getPropertyValue('--hg-delay'))<=-15,'movement must keep elapsed draw time');
  draw([]);draw([a]);assert.equal(mark().style.getPropertyValue('--hg-delay'),'0ms');
  const restored=mark();
  renderOverlay(svg,{sessionId:'new',annotations:[a]},{width:800,height:500});
  assert.notEqual(mark(),restored);assert.equal(mark().style.getPropertyValue('--hg-delay'),'0ms');
});

test('label boxes avoid other grounded targets and stay inside the viewport',()=>{
  const svg=new SvgNode('svg');
  renderOverlay(svg,{annotations:[
    {id:'one',shape:'ring',x:210,y:220,width:120,height:40,label:'第一步 <img src=x>'},
    {id:'two',shape:'box',x:210,y:130,width:140,height:50,label:'Second step'},
    {id:'edge',shape:'ring',x:615,y:345,width:30,height:20,label:'A very long label near an edge'}
  ]},{width:640,height:360});
  const labels=walk(svg,n=>n.attrs.class==='hg-label');
  assert.equal(labels.length,3);
  for(const label of labels){
    const b=label.children[0].attrs;
    assert.ok(+b.x>=12&&+b.y>=12&&+b.x+(+b.width)<=628&&+b.y+(+b.height)<=348);
  }
  const first=labels[0].children[0].attrs;
  assert.ok(+first.y>=240,'occupied space above the first target should move the label below it');
});
