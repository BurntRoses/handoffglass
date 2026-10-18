import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { renderOverlay } from '../src/desktop/overlay-renderer.mjs';
import { SHAPES, TONES, normalizeScene, flattenScene } from '../src/visual/scene.mjs';
class SvgNode {
  constructor(tag){this.tag=tag;this.attrs={};this.children=[];this.textContent='';}
  setAttribute(k,v){this.attrs[k]=v;}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=[...children];}
}
const orig=globalThis.document;
globalThis.document={createElementNS:(_ns,tag)=>new SvgNode(tag)};
const walk=(root,predicate)=>[root,...root.children.flatMap(c=>walk(c,predicate))].filter(predicate);
test('production SVG renderer supports all shapes without Electron or network',()=>{
  const svg=new SvgNode('svg');
  const shapes=SHAPES.map((shape,i)=>({id:`mark_${i}`,shape,x:100+i*50,y:250,color:TONES.info,label:'目标 <script> 你好',opacity:.8}));
  renderOverlay(svg,{annotations:shapes},{width:960,height:600});
  assert.equal(walk(svg,x=>x.tag==='g').length,SHAPES.length);
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
  assert.equal(walk(svg,x=>x.tag==='rect'&&x.attrs.mask==='url(#hg-spot-mask)').length,1);
  assert.equal(walk(svg,x=>x.tag==='ellipse'&&x.attrs.fill==='black').length,2);
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
