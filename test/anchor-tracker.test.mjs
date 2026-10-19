import test from 'node:test';
import assert from 'node:assert/strict';
import { HandoffManager } from '../src/core.mjs';
import { LocalBridge } from '../src/bridge.mjs';
import { NativeAnchorTracker } from '../src/native/anchor-tracker.mjs';

const target={app:'Example',role:'button',name:'Continue'};
const screen=[{id:'primary',x:0,y:0,width:1000,height:800,scaleFactor:1}];
const rect=(x,y)=>({x,y,width:100,height:48});
const base={mode:'handoff',title:'Step',message:'Check the original app',timeoutSeconds:120};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// No real Accessibility calls are made: the native reader is fully injected.
test('moving native UI controls move the actual overlay without restarting handoff or TTL', async()=>{
  const manager=new HandoffManager();let position=rect(400,300);let calls=0;
  const tracker=new NativeAnchorTracker({manager,locator:async()=>{calls++;return position;},getDisplays:()=>screen,intervalMs:60000});
  const session=manager.show({...base,x:position.x,y:position.y,width:position.width,height:position.height});
  assert.equal(tracker.track(session.id,target,position),true);
  const baseline=manager.get(session.id);let changes=0;manager.on('show',()=>changes++);
  position=rect(520,410);
  assert.equal(await tracker.recheck(),'tracking');
  const moved=manager.get(session.id);
  assert.equal(moved.annotations[0].x,520);
  assert.equal(moved.annotations[0].y,410);
  assert.equal(moved.timeoutAt,baseline.timeoutAt);
  assert.equal(moved.id,baseline.id);
  assert.equal(moved.verified,false);
  assert.equal(moved.targetTracking.status,'tracking');
  assert.equal(changes,1);
  assert.equal(await tracker.recheck(),'tracking');
  assert.equal(changes,1,'unchanged coordinates should not spam UI snapshots');
  manager.resolve(session.id,'declined');
  assert.equal(tracker.current,null);
  assert.equal(calls,2);
  tracker.close();manager.close();
});

test('vanished or permission-denied targets clear stale markings and restore only after a new grounded hit',async()=>{
  const manager=new HandoffManager();let available=false;
  const tracker=new NativeAnchorTracker({manager,locator:async()=>{
    if(!available)throw Object.assign(new Error('No exact match'),{code:'target_not_found'});
    return rect(380,290);
  },getDisplays:()=>screen,intervalMs:60000});
  const s=manager.show({...base,x:300,y:230});tracker.track(s.id,target,rect(300,230));
  assert.equal(await tracker.recheck(),'lost');
  assert.equal(manager.get(s.id).annotations.length,0);
  assert.equal(manager.get(s.id).targetTracking.reason,'target_not_found');
  assert.equal(manager.get(s.id).status,'awaiting_user');
  available=true;
  assert.equal(await tracker.recheck(),'tracking');
  assert.equal(manager.get(s.id).annotations[0].x,380);
  assert.equal(manager.get(s.id).timeoutAt,s.timeoutAt);
  tracker.close();manager.close();
});

test('display rearrangement hides stale locations until target is independently re-observed',async()=>{
  const manager=new HandoffManager();let displays=[...screen],hits=0;
  const tracker=new NativeAnchorTracker({manager,locator:async()=>{hits++;return rect(500,270);},getDisplays:()=>displays,intervalMs:60000});
  const s=manager.show({...base,x:400,y:250});tracker.track(s.id,target,rect(400,250));
  displays=[{...screen[0],id:'new-main',x:-100,y:0}];
  assert.equal(await tracker.recheck(),'layout_changed');
  assert.equal(manager.get(s.id).annotations.length,0);
  assert.equal(hits,0);
  assert.equal(await tracker.recheck(),'tracking');
  assert.equal(manager.get(s.id).annotations[0].x,500);
  tracker.close();manager.close();
});

test('late native results cannot resurrect a terminal or superseded handoff',async()=>{
  const manager=new HandoffManager();let complete;
  const tracker=new NativeAnchorTracker({manager,locator:()=>new Promise(resolve=>{complete=resolve;}),getDisplays:()=>screen,intervalMs:60000});
  const old=manager.show({...base,x:410,y:250});tracker.track(old.id,target,rect(410,250));
  const pending=tracker.recheck();
  manager.show({...base,x:600,y:450,title:'New task'});
  complete(rect(500,350));
  assert.equal(await pending,'obsolete');
  assert.equal(manager.get(old.id).status,'superseded');
  assert.equal(manager.active().annotations[0].x,600);
  assert.equal(tracker.current,null);
  tracker.close();manager.close();
});

test('scene templates move with a native target and advance revisions only when necessary',async()=>{
  const manager=new HandoffManager();let location=rect(250,200);
  const tracker=new NativeAnchorTracker({manager,locator:async()=>location,getDisplays:()=>screen,intervalMs:60000});
  const s=manager.show({...base,x:250,y:200,template:'focus'});
  tracker.track(s.id,target,location);
  location=rect(300,215);
  await tracker.recheck();
  const next=manager.get(s.id);
  assert.equal(next.sceneRevision,2);
  assert.equal(next.annotations[0].x,300);
  assert.equal(next.scene.layers.flatMap(l=>l.annotations).some(a=>a.x===300),true);
  await tracker.recheck();
  assert.equal(manager.get(s.id).sceneRevision,2);
  tracker.close();manager.close();
});

test('HTTP native-target handoff attaches a live tracker, and manual scene edits take control',async()=>{
  const manager=new HandoffManager();let loc=rect(200,190),calls=0;
  const bridge=new LocalBridge(manager,{headless:true,locator:async()=>{calls++;return loc;}});
  await bridge.start();bridge.displays=screen;
  const owner={'x-handoffglass-owner':'11111111-1111-4111-8111-111111111111',authorization:`Bearer ${bridge.agentToken}`,'content-type':'application/json'};
  const request=async path=>fetch(`http://127.0.0.1:${bridge.port}${path}`);
  const post=body=>fetch(`http://127.0.0.1:${bridge.port}/agent/show`,{method:'POST',headers:owner,body:JSON.stringify(body)});
  try{
    const first=await (await post({...base,target,template:'focus',requestId:'anchor-mcp-example'})).json();
    assert.equal(first.session.targetTracking.status,'tracking');
    assert.equal(first.session.sceneRevision,1);
    loc=rect(260,240);await bridge.anchors.recheck();
    assert.equal(manager.get(first.session.id).annotations[0].x,260);
    assert.equal(calls,2);
    const old=manager.get(first.session.id);
    const patch=await fetch(`http://127.0.0.1:${bridge.port}/agent/scene`,{method:'POST',headers:owner,
      body:JSON.stringify({sessionId:old.id,expectedRevision:old.sceneRevision,
        operations:[{op:'set_layer',layerId:old.scene.layers[0].id,visible:false}]})});
    assert.equal(patch.status,200);
    assert.equal(bridge.anchors.current,null);
    const manual=manager.get(old.id);
    loc=rect(300,260);
    await bridge.anchors.recheck();
    assert.deepEqual(manager.get(old.id).annotations,manual.annotations);
    const off=await (await post({...base,target,followTarget:false,title:'Static step'})).json();
    assert.equal(off.session.targetTracking,undefined);
  }finally{await bridge.stop();manager.close();}
});
