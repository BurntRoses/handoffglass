import test from 'node:test';
import assert from 'node:assert/strict';
import {HandoffManager} from '../src/core.mjs';
import {InteractionJournal} from '../src/local/interaction-journal.mjs';
import {LocalBridge} from '../src/bridge.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const body={title:'Step',message:'Check window',mode:'handoff',continuous:true,requestId:'continuous-test-1'};
test('same session retains ownership through report, verification and next step; only verified final ends it',()=>{
 const m=new HandoffManager();try{
 const first=m.show(body,owner);const ttl=first.timeoutAt;
 assert.equal(m.resolve(first.id,'completed').session.status,'user_action_reported');
 assert.equal(m.active().id,first.id);assert.equal(m.present(first.id,{...body,requestId:'premature-step-2'},owner).error,'verification_due');
 assert.equal(m.show(body,other).error,'busy');assert.equal(m.verify(first.id,other,true).error,'not_found');
 assert.equal(m.verify(first.id,owner,false,true).session.phase,'next_step');assert.equal(m.active().id,first.id);
 const second=m.present(first.id,{...body,title:'Next',requestId:'continuous-test-2'},owner).session;
 assert.equal(second.id,first.id);assert.equal(second.timeoutAt,ttl);assert.equal(second.step,2);
 assert.equal(m.present(first.id,{...body,title:'Next',requestId:'continuous-test-2'},owner).session.step,2);
 m.resolve(first.id,'completed');const final=m.verify(first.id,owner,true,true).session;
 assert.equal(final.phase,'complete');assert.equal(final.verified,true);assert.equal(m.active(),null);
 }finally{m.close();}
});
test('event wait returns existing events immediately, wakes on target loss and removes aborted waiters',async()=>{
 const m=new HandoffManager(),j=new InteractionJournal(m);try{
 const first=m.show(body,owner);const initial=await j.wait(first.id,{after:0,timeoutMs:30000});assert.ok(initial.events.length);
 const pending=j.wait(first.id,{after:initial.nextCursor,timeoutMs:30000});
 m.setAnchorState(first.id,{status:'lost',annotations:[],reason:'target_not_found'});
 assert.ok((await pending).events.some(e=>e.type==='target_lost'));assert.equal(j.pendingWaits,0);
 const abort=new AbortController();const waiting=j.wait(first.id,{after:j.read(first.id).nextCursor,timeoutMs:30000,signal:abort.signal});abort.abort();await waiting;
 assert.equal(j.listenerCount('event'),0);assert.equal(j.pendingWaits,0);
 }finally{j.close();m.close();}
});
test('real bridge push, cursor wait and global disable are authenticated and cancel active native tracking',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'hg-continuous-')),prior=process.env.HANDOFFGLASS_RUNTIME_DIR;process.env.HANDOFFGLASS_RUNTIME_DIR=dir;
 const m=new HandoffManager(),b=new LocalBridge(m,{headless:true});await b.start();const url=`http://127.0.0.1:${b.port}`;
 const headers={authorization:`Bearer ${b.agentToken}`,'x-handoffglass-owner':owner,'content-type':'application/json'};
 const post=(path,body)=>fetch(url+path,{method:'POST',headers,body:JSON.stringify(body)});
 const abort=new AbortController();let reader;
 try{
 assert.equal((await fetch(url+'/desktop/stream',{headers})).status,401);
 const stream=await fetch(url+'/desktop/stream',{headers:{authorization:`Bearer ${b.token}`},signal:abort.signal});reader=stream.body.getReader();await reader.read();
 const first=await (await post('/agent/show',body)).json();
 const frame=new TextDecoder().decode((await reader.read()).value);assert.match(frame,new RegExp(first.session.id));
 const initial=await (await fetch(url+`/agent/wait?continuous=1&sessionId=${first.session.id}&cursor=0&maxWaitMs=0`,{headers})).json();
 const pending=fetch(url+`/agent/wait?continuous=1&sessionId=${first.session.id}&cursor=${initial.nextCursor}&maxWaitMs=30000`,{headers}).then(r=>r.json());
 await fetch(url+'/decision',{method:'POST',headers:{authorization:`Bearer ${b.token}`,'content-type':'application/json'},body:JSON.stringify({id:first.session.id,status:'completed'})});
 const reported=await pending;assert.equal(reported.nextAction,'verify_in_app');assert.ok(reported.events.some(e=>e.type==='verification_required'));
 await post('/agent/integration-enabled',{enabled:false});assert.equal(m.active(),null);assert.equal(b.anchors.current,null);
 let calls=0;b.locator=()=>{calls++;throw Error('should not locate');};
 const disabled=await post('/agent/show',{...body,target:{app:'Test',role:'button',name:'Continue'}});assert.equal(disabled.status,423);assert.equal(calls,0);
 assert.equal((await (await post('/agent/integration-enabled',{enabled:true})).json()).enabled,true);
 }finally{abort.abort();await reader?.cancel().catch(()=>{});await b.stop();m.close();if(prior===undefined)delete process.env.HANDOFFGLASS_RUNTIME_DIR;else process.env.HANDOFFGLASS_RUNTIME_DIR=prior;await rm(dir,{recursive:true,force:true});}
});

test('ordinary movement is coalesced and does not wake an Agent waiting for a decision',async()=>{
 const m=new HandoffManager(),j=new InteractionJournal(m);try{
 const first=m.show({...body,x:10,y:10},owner);
 m.setAnchorState(first.id,{status:'tracking',annotations:first.annotations,signature:'layout'});
 const cursor=j.read(first.id).nextCursor;let settled=false;
 const pending=j.wait(first.id,{after:cursor,timeoutMs:30000}).then(r=>{settled=true;return r;});
 for(let i=0;i<20;i++)m.setAnchorState(first.id,{status:'tracking',annotations:[{...first.annotations[0],x:20+i}],signature:'layout'});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(settled,false);
 assert.equal(j.read(first.id,{after:cursor}).events.filter(e=>e.type==='target_moved').length,1);
 m.resolve(first.id,'completed');const result=await pending;
 assert.ok(result.events.some(e=>e.type==='verification_required'));assert.equal(j.pendingWaits,0);
 }finally{j.close();m.close();}
});

test('step retries return the current state during verification and after final completion',()=>{
 const m=new HandoffManager();try{
 const first=m.show(body,owner);m.resolve(first.id,'completed');m.verify(first.id,owner,true);
 const next={...body,title:'Next',requestId:'continuous-retry-2'};
 m.present(first.id,next,owner);m.resolve(first.id,'completed');
 assert.equal(m.present(first.id,next,owner).session.phase,'verifying');
 m.verify(first.id,owner,true,true);
 const retry=m.present(first.id,next,owner);assert.equal(retry.session.status,'completed');assert.equal(retry.session.step,2);
 assert.equal(m.active(),null);
 }finally{m.close();}
});
test('HTTP next-step retry preserves live native following without a second lookup',async()=>{
 const m=new HandoffManager();let calls=0,location={x:200,y:200,width:100,height:40};
 const b=new LocalBridge(m,{headless:true,locator:async()=>{calls++;return location;}});await b.start();
 b.displays=[{id:'main',x:0,y:0,width:1000,height:800,scaleFactor:1}];
 const headers={authorization:`Bearer ${b.agentToken}`,'x-handoffglass-owner':owner,'content-type':'application/json'};
 const post=async body=>await (await fetch(`http://127.0.0.1:${b.port}/agent/show`,{method:'POST',headers,body:JSON.stringify(body)})).json();
 try{
 const first=await post(body);m.resolve(first.session.id,'completed');m.verify(first.session.id,owner,true);
 const next={...body,sessionId:first.session.id,requestId:'anchor-retry-step2',target:{app:'Example',role:'button',name:'Continue'}};
 assert.equal((await post(next)).session.targetTracking.status,'tracking');
 assert.equal((await post(next)).session.step,2);assert.equal(calls,1);assert.equal(b.anchors.current.id,first.session.id);
 location={...location,x:300};await b.anchors.recheck();assert.equal(m.get(first.session.id).annotations[0].x,300);
 }finally{await b.stop();m.close();}
});
test('pausing during a native lookup prevents late guidance from appearing',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'hg-pause-race-')),prior=process.env.HANDOFFGLASS_RUNTIME_DIR;process.env.HANDOFFGLASS_RUNTIME_DIR=dir;
 let resolveLookup,started;const lookupStarted=new Promise(r=>{started=r;});
 const m=new HandoffManager(),b=new LocalBridge(m,{headless:true,locator:()=>{started();return new Promise(r=>{resolveLookup=r;});}});await b.start();
 b.displays=[{id:'main',x:0,y:0,width:1000,height:800,scaleFactor:1}];
 const headers={authorization:`Bearer ${b.agentToken}`,'x-handoffglass-owner':owner,'content-type':'application/json'};
 const post=(path,body)=>fetch(`http://127.0.0.1:${b.port}${path}`,{method:'POST',headers,body:JSON.stringify(body)});
 try{
 const pending=post('/agent/show',{...body,target:{app:'Example',role:'button',name:'Continue'}});
 await lookupStarted;await post('/agent/integration-enabled',{enabled:false});
 resolveLookup({x:200,y:200,width:100,height:40});const result=await pending;
 assert.equal(result.status,423);assert.equal((await result.json()).code,'disabled_by_user');
 assert.equal(m.active(),null);assert.equal(b.anchors.current,null);
 }finally{await b.stop();m.close();if(prior===undefined)delete process.env.HANDOFFGLASS_RUNTIME_DIR;else process.env.HANDOFFGLASS_RUNTIME_DIR=prior;await rm(dir,{recursive:true,force:true});}
});
