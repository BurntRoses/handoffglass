import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HandoffManager } from '../src/core.mjs';
import { attachSessionCheckpoint } from '../src/local/session-checkpoint.mjs';
import { TargetRegistry } from '../src/visual/target-registry.mjs';

const step = { title:'Choose folder', message:'Choose a folder in the original window.', continuous:true };

test('each verified step gets its own deadline while the task deadline is fixed', () => {
  let now=0;const m=new HandoffManager({clock:()=>now});
  try {
    const s=m.show({...step,timeoutSeconds:300},'a');now=299000;
    m.resolve(s.id,'completed','a');m.verify(s.id,'a',true);
    const next=m.present(s.id,{...step,timeoutSeconds:300},'a').session;
    assert.equal(next.timeoutAt,599000);assert.equal(next.taskTimeoutAt,s.taskTimeoutAt);
    now=300001;assert.equal(m.get(s.id).status,'awaiting_user');
    m.updateScene(s.id,'a',1,[]);assert.equal(m.get(s.id).timeoutAt,599000);
  } finally {m.close();}
});

test('observed-condition guides can be independently verified; human decisions cannot be skipped',()=>{
  const m=new HandoffManager();
  try {
    const guide=m.show({...step,mode:'guide',x:30,y:40},'a');
    assert.equal(m.verify(guide.id,'a',true,true).session.status,'completed');
    const human=m.show({...step,sensitive:true},'a');
    assert.equal(m.verify(human.id,'a',true,true).error,'verification_not_due');
    assert.equal(m.present(human.id,step,'a').error,'step_not_verified');
    assert.throws(()=>m.show({...step,sensitive:true,completion:{kind:'observed_condition'}},'a'),/Sensitive/);
  } finally {m.close();}
});

test('pause freezes a normal step, resumes into reobservation, and never extends a sensitive confirmation',()=>{
  let now=0;const m=new HandoffManager({clock:()=>now});
  try {
    const s=m.show({...step,timeoutSeconds:30},'a');now=15000;
    assert.equal(m.control(s.id,'a','pause').session.status,'paused');
    now=90000;assert.equal(m.get(s.id).status,'paused');
    const resumed=m.control(s.id,'a','resume').session;
    assert.equal(resumed.nextAction,'observe_app');assert.deepEqual(resumed.annotations,[]);
    const repeated=m.present(s.id,step,'a').session;assert.equal(repeated.step,1);
    m.resolve(s.id,'cancelled','a');
    const sensitive=m.show({...step,sensitive:true},'a');m.control(sensitive.id,'a','pause');
    now+=300001;assert.equal(m.get(sensitive.id).status,'declined');
  } finally {m.close();}
});

test('a shorter task deadline declines a pending sensitive decision but expires reported verification',()=>{
  for(const reported of [false,true])for(const paused of [false,true]){
    let now=0;const m=new HandoffManager({clock:()=>now});
    try{
      const request={...step,sensitive:true,timeoutSeconds:300,taskTimeoutSeconds:60};
      const session=m.show(request,'a');assert.equal(session.timeoutAt,60000);assert.equal(session.confirmationTimeoutAt,300000);
      if(reported)m.resolve(session.id,'completed','a');
      if(paused)m.control(session.id,'a','pause');
      assert.equal(m.get(session.id).confirmationTimeoutAt,reported?null:300000);
      now=60001;
      assert.equal(m.get(session.id).status,reported?'expired':'declined');
      assert.equal(m.active(),null);
      if(!reported)assert.deepEqual(m.show({...request,requestId:'same-sensitive-step'},'a'),{error:'declined_by_user',nextAction:'respect_refusal'});
    }finally{m.close();}
  }
});

test('recovery requires a scoped token, rotates it, clears old marks and revokes the previous owner',()=>{
  const m=new HandoffManager();
  try {
    const s=m.show({...step,x:22,y:33},'a'),token=m.issueResume(s.id,'a');
    assert.equal(m.issueResume(s.id,'a'),token,'safe request retries must retain the same recovery capability');
    assert.equal(m.resume(s.id,'0'.repeat(64),'b').error,'invalid_resume_token');
    const result=m.resume(s.id,token,'b');
    assert.equal(result.session.nextAction,'observe_app');assert.deepEqual(result.session.annotations,[]);
    assert.notEqual(result.resumeToken,token);assert.equal(m.getOwned(s.id,'a'),null);
    assert.equal(m.resume(s.id,token,'a').error,'invalid_resume_token');
    assert.equal(m.present(s.id,step,'b').session.step,1);
  } finally {m.close();}
});

test('private restart checkpoint contains no task text, coordinates or raw resume token',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'hg-checkpoint-')),m=new HandoffManager();let next;
  try {
    const checkpoint=await attachSessionCheckpoint(m,dir);
    const s=m.show({...step,title:'PRIVATE_TASK',x:12345,y:54321},'a'),token=m.issueResume(s.id,'a');
    await checkpoint.flush();const raw=await readFile(join(dir,'session-checkpoint.json'),'utf8');
    for(const privateValue of ['PRIVATE_TASK','12345','54321',token])assert.equal(raw.includes(privateValue),false);
    await checkpoint.close();m.close();next=new HandoffManager();
    const restored=await attachSessionCheckpoint(next,dir);
    assert.equal(next.active().phase,'reconnecting');assert.deepEqual(next.active().annotations,[]);
    assert.equal(next.resume(s.id,token,'b').session.nextAction,'observe_app');
    next.stopActive();await restored.close();await assert.rejects(readFile(join(dir,'session-checkpoint.json')),{code:'ENOENT'});
  } finally {m.close();next?.close();await rm(dir,{recursive:true,force:true});}
});

test('target references reject another owner, expired evidence and display layout changes',()=>{
  let now=0;const refs=new TargetRegistry({now:()=>now,ttlMs:100});
  const query={app:'App',role:'button',name:'Continue'},ref=refs.add('a',query,'layout-1');
  assert.deepEqual(refs.get(ref,'a','layout-1'),query);
  assert.throws(()=>refs.get(ref,'b','layout-1'),/fresh targetRef/);
  assert.throws(()=>refs.get(ref,'a','layout-2'),/fresh targetRef/);
  now=101;assert.throws(()=>refs.get(ref,'a','layout-1'),/fresh targetRef/);
});

test('recovery preserves a reported action and an explicit pause, without preserving task contents',async()=>{
 for(const paused of [false,true]){
  const dir=await mkdtemp(join(tmpdir(),'hg-reported-checkpoint-')),m=new HandoffManager();let next,restored;
  try{
   const checkpoint=await attachSessionCheckpoint(m,dir);
   const s=m.show({...step,title:'PRIVATE_REPORT',x:12345,y:54321,execution:'parked',sensitive:true},'original'),token=m.issueResume(s.id,'original');
   m.resolve(s.id,'completed');if(paused)m.control(s.id,'original','pause');
   await checkpoint.flush();const raw=await readFile(join(dir,'session-checkpoint.json'),'utf8');
   for(const privateValue of ['PRIVATE_REPORT','12345','54321',token])assert.equal(raw.includes(privateValue),false);
   await checkpoint.close();m.close();next=new HandoffManager();restored=await attachSessionCheckpoint(next,dir);
   const recovered=next.resume(s.id,token,'reconnected');
   assert.notEqual(recovered.resumeToken,token);assert.equal(next.getOwned(s.id,'original'),null);
   assert.equal(recovered.session.verified,false);assert.deepEqual(recovered.session.annotations,[]);
   assert.equal(recovered.session.completionSource,'user_report');
   if(paused){assert.equal(recovered.session.status,'paused');assert.equal(next.verify(s.id,'reconnected',true,true).error,'verification_not_due');next.control(s.id,'reconnected','resume');}
   assert.equal(next.get(s.id).phase,'verifying');
   assert.equal(next.present(s.id,step,'reconnected').error,'verification_due');
   assert.equal(next.verify(s.id,'reconnected',true,true).session.status,'completed');
  }finally{await restored?.close();m.close();next?.close();await rm(dir,{recursive:true,force:true});}
 }
});

test('same-process token recovery keeps reports and does not silently resume a user pause',()=>{
 const m=new HandoffManager();try{
  const s=m.show(step,'a'),token=m.issueResume(s.id,'a');m.resolve(s.id,'completed');
  const resumed=m.resume(s.id,token,'b');assert.equal(resumed.session.nextAction,'verify_in_app');assert.equal(resumed.session.verified,false);
  m.control(s.id,'b','pause');const paused=m.resume(s.id,resumed.resumeToken,'c');
  assert.equal(paused.session.status,'paused');m.control(s.id,'c','resume');
  assert.equal(m.verify(s.id,'c',true,true).session.verified,true);
 }finally{m.close();}
});
