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
    now+=300001;assert.equal(m.get(sensitive.id).status,'expired');
  } finally {m.close();}
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
