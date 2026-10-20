import test from 'node:test';
import assert from 'node:assert/strict';
import {placePanel} from '../src/desktop/panel-layout.mjs';
test('card stays on the target display and outside grounded button bounds',()=>{
 const area={x:-1920,y:-150,width:1920,height:1080};
 for(const target of [{x:-1850,y:-100,width:100,height:30},{x:-60,y:800,width:100,height:30},{x:-960,y:300,width:200,height:80}]){
  const p=placePanel(area,target);
  assert.ok(p.x>=area.x+12&&p.y>=area.y+12);assert.ok(p.x+420<=area.x+area.width-12);assert.ok(p.y+238<=area.y+area.height-12);
  const intersects=p.x<target.x+target.width/2&&p.x+420>target.x-target.width/2&&p.y<target.y+target.height/2&&p.y+238>target.y-target.height/2;
  assert.equal(intersects,false);
 }
});
test('coordinate-free guidance has a centered, deterministic fallback',()=>{
 assert.deepEqual(placePanel({x:0,y:0,width:1440,height:900},null),{x:510,y:331});
});
