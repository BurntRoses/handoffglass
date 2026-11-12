import test from 'node:test';
import assert from 'node:assert/strict';
import {PresentationLog} from '../src/local/presentation-log.mjs';
import {normalizeChange} from '../src/local/change.mjs';
import {HandoffManager} from '../src/core.mjs';
import {formatToolResult} from '../src/output.mjs';
const hash='a'.repeat(64),change={kind:'config',risk:'high',summary:'修改显示设置',before:{summary:'旧设置',hash},after:{summary:'新设置',hash}};
test('three projections switch independently without changing another layer or executing actions',()=>{
  const log=new PresentationLog(),s={id:'s',phase:'verifying',annotations:[],verification:{result:'inconclusive'}};
  log.observe(s);const review=log.present({changes:[change]},'A').review;
  for(const layer of ['guidance','review','verification']){
    log.configure({[layer+'Enabled']:false});const state=log.snapshot();assert.equal(state[layer],null);
    for(const other of ['guidance','review','verification'].filter(k=>k!==layer))assert.ok(state[other]);
    log.configure({});
  }
  assert.equal(log.owned(review.id,'B'),null);assert.equal(log.owned(review.id,'A').status,'waiting_review');
  assert.ok(log.events.every(e=>Number.isSafeInteger(e.seq)&&'sessionId'in e&&e.actor&&e.risk));log.close();
});
test('risk review waits, refuses stale decisions, times out to decline, and repeated declined changes do not ask twice',()=>{
  let now=1000;const log=new PresentationLog({now:()=>now});
  const review=log.present({changes:[change],timeoutSeconds:10},'A').review;
  assert.equal(log.present({changes:[{...change,summary:'different'}]},'B').error,'busy');
  assert.equal(log.decide(review.id,2,'reviewed').error,'stale_review');now=12000;
  assert.equal(log.decide(review.id,1,'reviewed').review.status,'declined');
  assert.equal(log.present({changes:[change]},'A').review.id,review.id);log.close();
});
test('only summaries and hashes are accepted; credentials are hashed before log and redacted again on export',()=>{
  assert.throws(()=>normalizeChange({...change,contents:'file'}));
  assert.throws(()=>normalizeChange({...change,before:{summary:'old',hash,content:'secret'}}));
  const log=new PresentationLog(),secret='sk-'+ 'x'.repeat(30),review=log.present({changes:[{...change,summary:secret,kind:'external'}]},'A').review;
  assert.equal(review.risk,'irreversible');assert.equal(review.changes[0].notice,'已不可撤回');assert.ok(!JSON.stringify(log.events).includes(secret));
  assert.throws(()=>log.export(review.id),/explicit_confirmation/);
  const replay=log.export(review.id,{confirmed:true});assert.equal(replay.readOnly,true);assert.ok(!JSON.stringify(replay).includes(secret));
  assert.equal(replay.entries[0].payload.review.changes[0].after.hash,hash);log.close();
});
test('inconclusive keeps independent verification pending with no stale coordinates, including compact responses',()=>{
  const m=new HandoffManager(),s=m.show({title:'授权结果',message:'在原应用完成',continuous:true,sensitive:true},'A');
  m.resolve(s.id,'completed');const result=m.verify(s.id,'A','inconclusive',true);
  assert.equal(result.session.status,'user_action_reported');assert.equal(result.session.phase,'verifying');assert.equal(result.session.verified,false);
  assert.equal(result.session.annotations.length,0);assert.equal(result.session.nextAction,'request_independent_evidence');
  assert.equal(formatToolResult(result,{compact:true}).session.verification.result,'inconclusive');
  assert.equal(m.present(s.id,{title:'another',message:'step'},'A').error,'verification_due');
  const final=m.verify(s.id,'A','verified',true);assert.equal(final.session.status,'completed');m.close();
});

test('refused changes stay refused after an unrelated review and cannot expose another owner',()=>{
 const log=new PresentationLog();
 try{
  const first=log.present({changes:[change]},'A').review;log.decide(first.id,1,'declined');
  const other=log.present({changes:[{...change,summary:'another setting'}]},'A').review;log.decide(other.id,1,'reviewed');
  assert.equal(log.present({changes:[change]},'A').review.status,'declined');
  assert.notEqual(log.present({changes:[change]},'B').review.id,first.id);
 }finally{log.close();}
});
test('redaction handles quoted JSON credentials and incomplete private keys before clipping',()=>{
 const log=new PresentationLog();
 try{
  const secret='unreleased-secret-123',privateKey='-----BEGIN PRIVATE KEY-----\n'+ 'A'.repeat(9000);
  const review=log.present({changes:[{...change,summary:'"password": "'+secret+'"',before:{summary:privateKey,hash}}]},'A').review;
  assert.equal(review.changes[0].before.redacted,true);assert.ok(!JSON.stringify(log.events).includes(secret));
  assert.ok(!JSON.stringify(log.events).includes('AAAA'));
 }finally{log.close();}
});
test('a declined review reopens only when explicitly requested and busy attempts retain the refusal',()=>{
 const log=new PresentationLog();
 try{
  const first=log.present({changes:[change]},'A').review;log.decide(first.id,1,'declined');
  const waiting=log.present({changes:[{...change,summary:'unrelated change'}]},'B').review;
  assert.equal(log.present({changes:[change],retryDeclined:true},'A').error,'busy');
  assert.equal(log.present({changes:[change]},'A').review.status,'declined');
  log.decide(waiting.id,1,'reviewed');
  const retry=log.present({changes:[change],retryDeclined:true},'A').review;
  assert.notEqual(retry.id,first.id);assert.equal(retry.status,'waiting_review');
  assert.equal(log.present({changes:[change],retryDeclined:true},'A').review.id,retry.id,'retry cannot renew a live review');
  log.decide(retry.id,1,'declined');assert.equal(log.present({changes:[change]},'A').review.id,retry.id);
  assert.throws(()=>log.present({changes:[change],retryDeclined:'true'},'A'),/boolean/);
 }finally{log.close();}
});
