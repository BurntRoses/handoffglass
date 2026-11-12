import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {observedRegion} from '../src/visual/observed-region.mjs';
import {quickMarkRequest} from '../src/visual/quick-mark.mjs';
import {layoutSignature} from '../src/native/calibration.mjs';
import {HandoffManager} from '../src/core.mjs';
import {LocalBridge} from '../src/bridge.mjs';
import {savePreferences} from '../src/local/preferences.mjs';
const displays=[{id:'left',x:-1440,y:-200,width:1440,height:900,scaleFactor:2},{id:'main',primary:true,x:0,y:0,width:1920,height:1080,scaleFactor:1}];
const bounds={x:20,y:40,width:200,height:80};
const frame={width:1000,height:600,bounds:{x:-1200,y:80,width:500,height:300}};
const owner='11111111-1111-4111-8111-111111111111';
test('image crop/resize on a negative-coordinate high-DPI display maps exactly, without a guessed scale',()=>{
  assert.deepEqual(observedRegion(bounds,frame,displays),{x:-1140,y:120,width:100,height:40});
  const narrow={x:10,y:20,width:8,height:5};
  assert.deepEqual(observedRegion(narrow,undefined,displays),{x:14,y:22.5,width:8,height:5});
  const mark=quickMarkRequest({shape:'spotlight',bounds,frame},displays).annotations[0];
  assert.deepEqual([mark.x,mark.y,mark.width,mark.height],[-1140,120,100,40]);
});
test('measured bounds are never silently resized, even at screen edges or beyond the old 1200 limit',()=>{
  const r={x:0,y:0,width:1920,height:1080};
  const a=quickMarkRequest({shape:'box',bounds:r},displays).annotations[0];
  assert.deepEqual([a.x,a.y,a.width,a.height],[960,540,1920,1080]);
  assert.throws(()=>quickMarkRequest({bounds:r,placement:'left'},displays));
  assert.throws(()=>quickMarkRequest({bounds:r,position:{x:0,y:0}},displays));
  assert.throws(()=>quickMarkRequest({frame},displays));
});
test('bad, old or ambiguous observations fail with actionable codes before rendering',()=>{
  for(const [b,f,code]of [
    [{...bounds,x:-1},frame,'outside_frame'],[{...bounds,width:1001},frame,'outside_frame'],
    [bounds,{...frame,capturedAt:1000},'stale_observation'],[bounds,{...frame,capturedAt:60000},'stale_observation'],
    [bounds,{...frame,layoutSignature:'a'.repeat(16)},'layout_changed'],
    [bounds,{...frame,bounds:{x:-100,y:0,width:500,height:300}},'ambiguous_frame'],
    [{x:1910,y:0,width:100,height:20},undefined,'outside_display'],
    [{...bounds,width:0},undefined,'invalid_bounds'],[bounds,{...frame,width:NaN},'invalid_frame']
  ])assert.throws(()=>observedRegion(b,f,displays,{now:40000,layoutSignature:layoutSignature(displays)}),{code});
  assert.ok(observedRegion(bounds,{...frame,capturedAt:39000,layoutSignature:layoutSignature(displays)},displays,{now:40000,layoutSignature:layoutSignature(displays)}));
});
test('global DIP regions may cross adjacent screens, but may not cover gaps',()=>{
  const cross={x:-100,y:100,width:200,height:80};
  assert.equal(observedRegion(cross,undefined,displays).x,0);
  assert.throws(()=>observedRegion({...cross,y:680},undefined,displays),{code:'outside_display'});
});
test('each host mark can carry its own image frame on mixed-DPI displays',()=>{
  const r=quickMarkRequest({marks:[{shape:'box',bounds,frame},{shape:'ring',bounds:{x:10,y:10,width:100,height:50},frame:{width:1920,height:1080,bounds:{x:0,y:0,width:1920,height:1080}}}]},displays);
  assert.deepEqual(r.annotations.map(a=>a.x),[-1140,60]);
});
test('host render/session/updates and capability discovery never invoke denied native services; layout invalidates fixed marks',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'hg-host-observed-')),old=process.env.HANDOFFGLASS_RUNTIME_DIR;
  process.env.HANDOFFGLASS_RUNTIME_DIR=dir;await savePreferences({enabled:true},dir);
  let nativeCalls=0;const denied=async()=>{nativeCalls++;throw Object.assign(Error('denied'),{code:'permission_denied'});};
  const m=new HandoffManager(),b=new LocalBridge(m,{headless:true,locator:denied,inspector:denied});
  b.permissions=denied;await b.start();b.displays=displays;
  const call=async(path,body,desktop=false)=>{
    const res=await fetch(`http://127.0.0.1:${b.port}${path}`,{method:body?'POST':'GET',headers:{authorization:`Bearer ${desktop?b.token:b.agentToken}`,'content-type':'application/json','x-handoffglass-owner':owner},...(body?{body:JSON.stringify(body)}:{})});
    return {status:res.status,body:await res.json()};
  };
  try{
    assert.equal((await call('/agent/capabilities')).body.runtime.native.status,'not_probed');
    const drawing=await call('/agent/mark',{bounds,frame,shape:'box',requestId:'host-drawing-1'});
    assert.equal(drawing.status,200);assert.equal(m.active().annotations[0].x,-1140);
    assert.equal((await call('/agent/mark',{bounds,frame,shape:'box',requestId:'host-drawing-1'})).body.id,drawing.body.id);
    await call('/agent/mark',{action:'update',id:drawing.body.id,expectedRevision:1,bounds:{x:10,y:10,width:100,height:80}});
    assert.equal(m.active().annotations[0].x,60);
    await call('/hello',{displays:[{...displays[1],width:1800}]},true);
    assert.equal(m.active(),null,'A changed display layout must clear an old fixed drawing');
    b.displays=displays;
    const first=await call('/agent/show',{continuous:true,execution:'attached',bounds,frame,title:'查看区域',message:'在此查看',requestId:'host-step-1'});
    assert.equal(first.status,200,JSON.stringify(first.body));assert.equal(first.body.observation.tracking,'fixed');
    const id=first.body.session.id,expiry=first.body.session.timeoutAt;
    const changed=await call('/agent/scene',{sessionId:id,expectedRevision:1,bounds:{x:120,y:20,width:90,height:30},shape:'box'});
    assert.equal(changed.status,200,JSON.stringify(changed.body));assert.equal(changed.body.session.annotations[0].x,165);assert.equal(changed.body.session.timeoutAt,expiry);
    assert.equal((await call('/agent/scene',{sessionId:id,expectedRevision:1,bounds})).body.code,'revision_conflict');
    await call('/hello',{displays:[{...displays[1],width:1800}]},true);
    assert.equal(m.get(id).annotations.length,0);assert.equal(m.get(id).nextAction,'reobserve_target');
    assert.equal((await call('/agent/scene',{sessionId:id,expectedRevision:m.get(id).sceneRevision,bounds})).body.code,'target_unavailable');
    const recovered=await call('/agent/show',{sessionId:id,continuous:true,title:'查看区域',message:'在此查看',bounds:{x:20,y:20,width:100,height:30},requestId:'host-step-recovery'});
    assert.equal(recovered.status,200,JSON.stringify(recovered.body));assert.equal(m.get(id).annotations.length,1);assert.equal(m.get(id).step,1);
    m.resolve(id,'completed');assert.equal(m.get(id).verified,false);
    await call('/agent/verify',{sessionId:id,verified:true,finish:true,expectedStep:m.get(id).step});
    assert.equal(m.get(id).status,'completed');assert.equal(nativeCalls,0);
  }finally{await b.stop();m.close();if(old===undefined)delete process.env.HANDOFFGLASS_RUNTIME_DIR;else process.env.HANDOFFGLASS_RUNTIME_DIR=old;await rm(dir,{recursive:true,force:true});}
});
