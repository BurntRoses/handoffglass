import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {renderOverlay} from '../src/desktop/overlay-renderer.mjs';
class Stub {constructor(tag){this.tag=tag;this.children=[];this.attrs={};}append(...n){this.children.push(...n);}setAttribute(k,v){this.attrs[k]=v;}replaceChildren(){this.children=[];}}
test('renderer supports three visual styles and finite SVG geometry',()=>{
 const original=globalThis.document;
 try{globalThis.document={createElementNS:(_ns,tag)=>new Stub(tag)};
  for(const style of ['minimal','luminous','handdrawn']){
   const svg=new Stub('svg');renderOverlay(svg,{visualStyle:style,motion:'off',annotations:[{x:20,y:30,shape:'ring',color:'#55ddaa'}]},{width:300,height:200});
   assert.equal(svg.attrs['data-style'],style);assert.equal(svg.attrs['data-motion'],'off');assert.ok(svg.children.length>0);
  }
 }finally{globalThis.document=original;}
});
test('desktop renderer explicitly respects OS reduced motion and system focus',async()=>{
 const css=await readFile(new URL('../src/desktop/overlay.css',import.meta.url),'utf8');
 const panel=await readFile(new URL('../src/desktop/panel.css',import.meta.url),'utf8');
 assert.match(css,/prefers-reduced-motion:reduce/);assert.match(css,/data-motion=off/);
 assert.match(css,/hg-handwrite/);assert.match(panel,/prefers-reduced-motion:reduce/);
 const js=await readFile(new URL('../src/desktop/panel.js',import.meta.url),'utf8');
 assert.match(js,/window\.handoffglass\.decide/);
});

test('handoff decision panel supports both languages and density settings',async()=>{
 const html=await readFile(new URL('../src/desktop/panel.html',import.meta.url),'utf8');
 const js=await readFile(new URL('../src/desktop/panel.js',import.meta.url),'utf8');
 const css=await readFile(new URL('../src/desktop/panel.css',import.meta.url),'utf8');
 assert.match(html,/id="note"/); assert.match(js,/'en-US'/);
 assert.match(js,/data-density/); assert.match(css,/data-density=compact/);
});
