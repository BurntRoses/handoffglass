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

test('layout avoids multiple targets and retains a stable nearby safe position',()=>{
 const area={x:0,y:0,width:1400,height:900},target={x:700,y:450,width:100,height:50};
 const obstruction={x:1000,y:450,width:300,height:300};
 const point=placePanel(area,target,{targets:[target,obstruction]});
 assert.ok(point.x+420<=obstruction.x-obstruction.width/2 || point.y+238<=obstruction.y-obstruction.height/2 || point.y>=obstruction.y+obstruction.height/2);
 const moved=placePanel(area,{...target,x:701},{targets:[{...target,x:701},obstruction],previous:point});
 assert.deepEqual(moved,point);
});
test('compact strip docks at the top of the chosen work area',()=>{
 assert.deepEqual(placePanel({x:-1600,y:50,width:1600,height:900},null,{height:90,compact:true}),{x:-1010,y:62});
});
