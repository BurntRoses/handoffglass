import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveGroundedTarget, GroundingError } from '../src/visual/grounding.mjs';
const now=100000;
const displays=[{id:'left',x:-1200,y:0,width:1200,height:800},{id:'main',x:0,y:0,width:1600,height:900}];
const candidate = {app:'Settings',role:'button',name:'Review',source:'accessibility',coordinateSpace:'global_DIP',
  observedAt:now-150,bounds:{x:-320,y:200,width:120,height:40},enabled:true,visible:true,occluded:false};
const query={app:'Settings',role:'button',name:'Review'};
const run=(candidates,opts={})=>resolveGroundedTarget(query,candidates,{now,displays,...opts});
test('accepts independently grounded negative-screen DIP bounds with origin evidence',()=>{
  const t=run([candidate]);
  assert.deepEqual([t.x,t.y,t.width,t.height],[-260,220,120,40]);
  assert.equal(t.source,'accessibility');
});
test('refuses ambiguous duplicate text rather than selecting first',()=>{
  assert.throws(()=>run([candidate,{...candidate,bounds:{x:600,y:120,width:120,height:40}}]),e=>e instanceof GroundingError && e.code==='ambiguous');
});
test('refuses stale, future, occluded, unproven visibility and invalid coordinate spaces',()=>{
  for(const item of [
    {...candidate,observedAt:now-5000},
    {...candidate,observedAt:now+5},
    {...candidate,occluded:true},
    {...candidate,visible:false},
    {...candidate,occluded:undefined},
    {...candidate,coordinateSpace:'screenshot_pixels'}
  ]) assert.throws(()=>run([item]),GroundingError);
});
test('fails if matched bounds are offscreen or no displays are available',()=>{
  assert.throws(()=>run([{...candidate,bounds:{x:-2000,y:0,width:20,height:20}}]),e=>e.code==='offscreen');
  assert.throws(()=>run([candidate],{displays:[]}),e=>e.code==='invalid_candidates');
});
