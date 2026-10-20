import test from 'node:test';
import assert from 'node:assert/strict';
import { requireConsent, physicalRectToDIP, normalizeNativeOutput, locateNative, nativeCommand, normalizeInspection, inspectNative } from '../src/native/locator.mjs';
import { BrokerClient } from '../src/runtime.mjs';
const displays=[
  {id:'left',x:-1280,y:0,width:1280,height:800,scaleFactor:1,physicalBounds:{x:-2560,y:0,width:2560,height:1600}},
  {id:'main',x:0,y:0,width:1920,height:1080,scaleFactor:1,physicalBounds:{x:0,y:0,width:1920,height:1080}}
];
const query={app:'chrome',role:'button',name:'Continue'};
const candidate=(bounds,overrides={})=>({ ...query, bounds,observedAt:Date.now(),enabled:true,visible:true,occluded:false,...overrides });
test('upgrading an old running broker gives an actionable restart instead of a generic missing route',async()=>{
  const client=new BrokerClient();
  client.request=async()=>{throw Object.assign(new Error('Not found'),{httpCode:404});};
  await assert.rejects(client.inspect(),e=>e.code==='broker_upgrade_required' && e.message.includes('Restart HandoffGlass'));
});
test('foreground inspection discovers labels, omits values and refuses unsafe or ambiguous bounds',async()=>{
  const control=candidate({x:100,y:40,width:120,height:60},{value:'secret',text:'private'});
  const result=await inspectNative(displays,{platform:'win32',env:{HANDOFFGLASS_ENABLE_ACCESSIBILITY:'1'},command:{command:'mock',args:[]},
    runner:async(_cmd,q)=>{assert.deepEqual(q,{mode:'inspect'});return {app:query.app,candidates:[control],truncated:true};}});
  assert.equal(result.controls[0].name,'Continue');
  assert.equal(result.controls[0].targetable,true);
  assert.equal(result.truncated,true);
  assert.equal(JSON.stringify(result).includes('secret'),false);
  const duplicates=normalizeInspection({app:query.app,candidates:[control,control]},displays,'win32');
  assert.equal(duplicates.controls.some(c=>c.targetable),false);
  const stale=normalizeInspection({app:query.app,candidates:[{...control,observedAt:Date.now()-5000}]},displays,'win32');
  assert.equal(stale.controls[0].targetable,false);
  assert.equal('bounds' in stale.controls[0],false);
  assert.throws(()=>normalizeInspection({app:query.app,candidates:[{...control,role:'textfield'}]},displays,'win32'),e=>e.code==='native_error');
  assert.throws(()=>normalizeInspection({app:query.app,candidates:Array(49).fill(control)},displays,'win32'),e=>e.code==='native_error');
  await assert.rejects(inspectNative(displays,{env:{HANDOFFGLASS_RUNTIME_DIR:'/not-a-user-runtime'}}),e=>e.code==='consent_required');
});
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
