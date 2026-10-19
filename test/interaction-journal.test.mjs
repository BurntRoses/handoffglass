import test from 'node:test';
import assert from 'node:assert/strict';
import { HandoffManager } from '../src/core.mjs';
import { InteractionJournal,recoveryFor } from '../src/local/interaction-journal.mjs';
import { LocalBridge } from '../src/bridge.mjs';
import { summarizeDiagnostics } from '../src/desktop/center-model.mjs';
const base={title:'Private permission details',message:'Never store account or password',timeoutSeconds:120};
const ownerA='11111111-1111-4111-8111-111111111111';
const ownerB='22222222-2222-4222-8222-222222222222';

test('journal records only bounded event codes; no target name, coordinates or task text',()=>{
 let t=10_000;const manager=new HandoffManager({clock:()=>t});
 const journal=new InteractionJournal(manager,{now:()=>t,maxEvents:4});
 const s=manager.show({...base,x:250,y:100});
 assert.equal(journal.read(s.id).events[0].type,'started');
 manager.setAnchorState(s.id,{status:'tracking',annotations:s.annotations,signature:'layout1',observedAt:t});
 manager.setAnchorState(s.id,{status:'tracking',annotations:[{...s.annotations[0],x:290}],signature:'layout1',observedAt:t});
 manager.setAnchorState(s.id,{status:'lost',annotations:[],signature:'layout1',reason:'permission_denied',observedAt:null});
 assert.equal(recoveryFor(manager.get(s.id)),'check_accessibility_permission');
 manager.setAnchorState(s.id,{status:'tracking',annotations:s.annotations,signature:'layout1',observedAt:t});
 manager.resolve(s.id,'completed');
 const stream=journal.read(s.id);
 assert.equal(stream.events.length,4);
 assert.equal(stream.truncated,true);
 assert.deepEqual(stream.events.map(x=>x.type),['target_moved','target_lost','target_restored','completed']);
 assert.equal(recoveryFor(manager.get(s.id)),'verify_downstream');
 assert.equal(manager.get(s.id).verified,false);
 const data=JSON.stringify(stream);
 assert.doesNotMatch(data,/Private permission|password|"x":290|"x":250|"y":100|account/i);
 assert.deepEqual(journal.read(s.id,{after:stream.nextCursor}).events,[]);
 assert.throws(()=>journal.read(s.id,{after:-1}),/Invalid event/);
 journal.close();manager.close();
});

test('scene takeover is recorded without making an unverified target authoritative',()=>{
 const manager=new HandoffManager(),journal=new InteractionJournal(manager);
 const s=manager.show({...base,x:20,y:35,template:'focus'});
 manager.setAnchorState(s.id,{status:'tracking',annotations:s.annotations,observedAt:Date.now(),signature:'layout'});
 const result=manager.updateScene(s.id,'local',1,[{op:'set_layer',layerId:s.scene.layers[0].id,visible:false}]);
 assert.equal(result.error,undefined);
 assert.equal(result.session.targetTracking.status,'manual');
 assert.equal(recoveryFor(result.session),'agent_owns_scene');
 assert.ok(journal.read(s.id).events.some(x=>x.type==='tracking_released'));
 journal.close();manager.close();
});

test('HTTP event cursor is owner-scoped, strictly validated and cannot leak details to diagnostics',async()=>{
 const manager=new HandoffManager(),bridge=new LocalBridge(manager,{headless:true});
 await bridge.start();const url=`http://127.0.0.1:${bridge.port}`;
 const agent=owner=>({authorization:`Bearer ${bridge.agentToken}`,'x-handoffglass-owner':owner,'content-type':'application/json'});
 const fetchAgent=(path,owner=ownerA)=>fetch(url+path,{headers:agent(owner)});
 const post=(path,body,owner=ownerA)=>fetch(url+path,{method:'POST',headers:agent(owner),body:JSON.stringify(body)});
 try {
  const r=await (await post('/agent/show',{...base,mode:'handoff'})).json();
  const id=r.session.id;
  const p=`/agent/events?sessionId=${id}`;
  assert.equal((await fetchAgent(p,ownerB)).status,404);
  assert.equal((await fetchAgent(p+'\u0026after=-1')).status,400);
  assert.equal((await fetchAgent(p+'\u0026limit=300')).status,400);
  assert.equal((await fetch(url+p,{headers:{authorization:'Bearer invalid'}})).status,401);
  const first=await (await fetchAgent(p)).json();
  assert.deepEqual(first.events.map(x=>x.type),['started']);
  assert.equal(first.recovery,'await_human_or_continue');
  const second=await (await fetchAgent(p+`&after=${first.nextCursor}`)).json();
  assert.deepEqual(second.events,[]);
  const final=await (await post('/agent/cancel',{sessionId:id})).json();
  assert.equal(final.session.status,'cancelled');
  const last=await (await fetchAgent(p+`&after=${first.nextCursor}`)).json();
  assert.deepEqual(last.events.map(x=>x.type),['cancelled']);
  assert.equal(last.recovery,'stopped');
  const raw=await (await fetch(url+'/desktop/diagnostics',{headers:{authorization:`Bearer ${bridge.token}`}})).json();
  const diag=summarizeDiagnostics(raw);
  assert.ok(diag.timeline.some(e=>e.type==='cancelled'));
  assert.doesNotMatch(JSON.stringify(diag),/Private permission|password|sessionId|11111111/);
  assert.equal((await fetchAgent('/agent/events?sessionId=missing')).status,404);
 }finally{await bridge.stop();manager.close();}
});

test('lost target cannot be resurrected by agent scene edits; cursor reports recovery guidance',async()=>{
 const manager=new HandoffManager(),bridge=new LocalBridge(manager,{headless:true});
 await bridge.start();const url=`http://127.0.0.1:${bridge.port}`;
 const headers={authorization:`Bearer ${bridge.agentToken}`,'x-handoffglass-owner':ownerA,'content-type':'application/json'};
 const post=(path,body)=>fetch(url+path,{method:'POST',headers,body:JSON.stringify(body)});
 try {
  const r=await (await post('/agent/show',{...base,mode:'handoff',scene:{version:1,layers:[{id:'focus',annotations:[{id:'one',x:50,y:40,shape:'ring'}]}]}})).json();
  const id=r.session.id;
  manager.setAnchorState(id,{status:'lost',annotations:[],signature:'layout1',reason:'target_not_found',observedAt:null});
  assert.equal(manager.updateScene(id,ownerA,1,[{op:'set_layer',layerId:'focus',visible:true}]).error,'target_unavailable');
  const patch=await post('/agent/scene',{sessionId:id,expectedRevision:1,operations:[{op:'set_layer',layerId:'focus',visible:true}]});
  assert.equal(patch.status,409);
  assert.equal((await patch.json()).code,'target_unavailable');
  assert.equal(manager.get(id).annotations.length,0);
  const event=await (await fetch(url+`/agent/events?sessionId=${id}`,{headers})).json();
  assert.equal(event.recovery,'await_reacquisition');
  assert.ok(event.events.some(x=>x.type==='target_lost'));
  assert.equal((await post('/agent/cancel',{sessionId:id})).status,200);
 } finally {await bridge.stop();manager.close();}
});

test('journal prunes old sessions, clamps cursors and tracks renewed failure reasons',()=>{
 const manager=new HandoffManager(), journal=new InteractionJournal(manager,{maxSessions:2});
 const a=manager.show({...base,x:300,y:220});
 manager.setAnchorState(a.id,{status:'lost',annotations:[],signature:'a',reason:'target_not_found'});
 manager.setAnchorState(a.id,{status:'lost',annotations:[],signature:'a',reason:'permission_denied'});
 const snapshot=journal.read(a.id);
 assert.deepEqual(snapshot.events.slice(-2).map(e=>e.reason),['target_not_found','permission_denied']);
 assert.equal(journal.read(a.id,{after:1_000_000}).nextCursor,snapshot.nextCursor);
 const b=manager.show({...base,title:'Second'});
 const c=manager.show({...base,title:'Third'});
 assert.equal(journal.read(a.id).events.length,0);
 assert.ok(journal.read(b.id).events.some(x=>x.type==='superseded'));
 assert.ok(journal.read(c.id).events.some(x=>x.type==='started'));
 journal.close();manager.close();
});

test('an expired handoff is observed without false completion or a revived overlay',()=>{
 let now=5000;
 const manager=new HandoffManager({clock:()=>now});
 const journal=new InteractionJournal(manager,{now:()=>now});
 const s=manager.show({...base,timeoutSeconds:10});
 now+=10001;
 const expired=manager.get(s.id);
 assert.equal(expired.status,'expired');
 assert.equal(expired.verified,false);
 assert.equal(recoveryFor(expired),'request_again_if_needed');
 assert.deepEqual(journal.read(s.id).events.map(x=>x.type),['started','expired']);
 journal.close();manager.close();
});
