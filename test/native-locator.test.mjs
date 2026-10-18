import test from 'node:test';
import assert from 'node:assert/strict';
import { requireConsent, physicalRectToDIP, normalizeNativeOutput, locateNative, nativeCommand } from '../src/native/locator.mjs';
const displays=[
  {id:'left',x:-1280,y:0,width:1280,height:800,scaleFactor:1,physicalBounds:{x:-2560,y:0,width:2560,height:1600}},
  {id:'main',x:0,y:0,width:1920,height:1080,scaleFactor:1,physicalBounds:{x:0,y:0,width:1920,height:1080}}
];
const query={app:'chrome',role:'button',name:'Continue'};
const candidate=(bounds,overrides={})=>({ ...query, bounds,observedAt:Date.now(),enabled:true,visible:true,occluded:false,...overrides });
test('accessibility enumeration is off by default and opt-in is explicit',()=>{
  assert.throws(()=>requireConsent({}),error=>error.code==='consent_required');
  assert.doesNotThrow(()=>requireConsent({HANDOFFGLASS_ENABLE_ACCESSIBILITY:'1'}));
  assert.throws(()=>nativeCommand('linux'),error=>error.code==='unsupported_platform');
});
test('UI Automation physical pixels use the correct display-specific DIP mapping',()=>{
  assert.deepEqual(physicalRectToDIP({x:-2000,y:400,width:200,height:100},displays),
    {x:-1000,y:200,width:100,height:50});
  assert.deepEqual(physicalRectToDIP({x:100,y:50,width:100,height:40},displays),
    {x:100,y:50,width:100,height:40});
  assert.throws(()=>physicalRectToDIP({x:99999,y:0,width:100,height:20},displays),error=>error.code==='display_mapping');
});
test('native result fails closed for ambiguous, stale, occluded or misleading coordinate results',()=>{
  const bounds={x:100,y:70,width:80,height:20};
  assert.equal(normalizeNativeOutput({candidates:[candidate(bounds)]},query,displays,'win32').x,140);
  assert.throws(()=>normalizeNativeOutput({candidates:[candidate(bounds),candidate(bounds)]},query,displays,'win32'),error=>error.code==='ambiguous');
  assert.throws(()=>normalizeNativeOutput({candidates:[candidate(bounds,{occluded:true})]},query,displays,'win32'),error=>error.code==='not_interactable');
  assert.throws(()=>normalizeNativeOutput({candidates:[candidate(bounds,{observedAt:Date.now()-10000})]},query,displays,'win32'),error=>error.code==='stale');
  assert.throws(()=>normalizeNativeOutput({error:'Denied',code:'permission_denied'},query,displays,'darwin'),error=>error.code==='permission_denied');
});
test('foreground locator is injectable for hermetic tests and returns only grounded coordinates',async()=>{
  let seen;
  const result=await locateNative(query,displays,{platform:'win32',env:{HANDOFFGLASS_ENABLE_ACCESSIBILITY:'1'}, command:{command:'mock',args:[]},
    runner:async (_cmd,q)=>{seen=q;return {candidates:[candidate({x:100,y:40,width:120,height:60})]};}});
  assert.deepEqual(seen,query);
  assert.equal(result.x,160);
  assert.equal(result.y,70);
  assert.equal(result.coordinateSpace,'global_DIP');
});
