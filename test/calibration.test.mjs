import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectLayout, layoutSignature, compareObservation} from '../src/native/calibration.mjs';
import {physicalRectToDIP} from '../src/native/locator.mjs';
import {HandoffManager} from '../src/core.mjs';
import {LocalBridge} from '../src/bridge.mjs';
const displays=[{id:'left',x:-1280,y:0,width:1280,height:800,scaleFactor:2,physicalBounds:{x:-2560,y:0,width:2560,height:1600}},
{id:'main',x:0,y:0,width:1920,height:1080,scaleFactor:1,physicalBounds:{x:0,y:0,width:1920,height:1080}}];
test('physical UIA coordinates that span monitors are not guessed',()=>{
  assert.equal(physicalRectToDIP({x:-100,y:40,width:100,height:30},displays).x,-50);
  assert.throws(()=>physicalRectToDIP({x:-20,y:40,width:40,height:30},displays),e=>e.code==='display_mapping');
  assert.throws(()=>physicalRectToDIP({x:1910,y:40,width:120,height:30},displays),e=>e.code==='display_mapping');
  assert.throws(()=>physicalRectToDIP({x:-2600,y:40,width:120,height:30},displays),e=>e.code==='display_mapping');
});
test('deterministic layout revision independent of monitor ordering',()=>{
  const a=layoutSignature(displays);
  assert.match(a,/^[0-9a-f]{16}$/);
  assert.equal(layoutSignature([...displays].reverse()),a);
  assert.notEqual(layoutSignature([{...displays[0],x:-1500},displays[1]]),a);
  assert.equal(inspectLayout(displays,'win32').status,'metadata_consistent');
  assert.deepEqual(inspectLayout([{...displays[0],x:-200},displays[1]],'win32').issues,['overlapping_dip_displays']);
  assert.equal(inspectLayout([{...displays[0],physicalBounds:null},displays[1]],'win32').status,'inconsistent');
});
test('explicit reobservation always reports nonverified outcomes',()=>{
  const prior={x:100,y:200,width:80,height:24,layoutSignature:layoutSignature(displays)};
  const current={x:102,y:201,width:80,height:24};
  assert.deepEqual(compareObservation(prior,current,prior.layoutSignature),{state:'unchanged',deltaDip:2.2,locationVerified:false});
  assert.equal(compareObservation(prior,{...current,x:200},prior.layoutSignature).state,'moved');
  assert.equal(compareObservation(prior,current,'ffffffffffffffff').state,'display_changed');
  assert.equal(compareObservation(null,current,prior.layoutSignature).state,'unavailable');
});
test('ui_locate may compare a prior point without clicking or rewriting the earlier observation',async()=>{
  const manager=new HandoffManager(); const bridge=new LocalBridge(manager,{headless:true,locator:async()=>({x:100,y:80,width:50,height:20,source:'mock',observedAt:Date.now()})});
  bridge.displays=displays;
  await bridge.start();
  const headers={authorization:`Bearer ${bridge.agentToken}`,'x-handoffglass-owner':'11111111-1111-4111-8111-111111111111','content-type':'application/json'};
  const body={target:{app:'test',role:'button',name:'Continue'},previous:{x:100,y:80,width:50,height:20,layoutSignature:layoutSignature(displays)}};
  try{
    const r=await fetch(`http://127.0.0.1:${bridge.port}/agent/locate`,{method:'POST',headers,body:JSON.stringify(body)});
    assert.equal(r.status,200); const data=await r.json();
    assert.equal(data.comparison.state,'unchanged');
    assert.equal(data.comparison.locationVerified,false);
    assert.equal(data.target.layoutSignature,layoutSignature(displays));
    assert.match(data.warning,/not permission/);
  }finally{await bridge.stop();manager.close();}
});
