import test from 'node:test';
import assert from 'node:assert/strict';
import { formatToolResult, continuationFor } from '../src/output.mjs';
test('default response preserves full contract and detailed display scale', () => {
  const original = { displays: [{ id:'primary', x:0, y:0, width:1200, height:800, scaleFactor:2 }], connected:true };
  assert.equal(formatToolResult(original), original);
});
test('compact response strips prose and repeated annotations but keeps important outcome', () => {
  const original = { session: { id:'xyz', status:'completed', mode:'handoff', verified:false, completionSource:'user_report',
    title:'Private', message:'a'.repeat(999), annotations: [{ x:3,y:7 }] }, visible:true,
    instruction:'user confirmation is not independent verification' };
  const out = formatToolResult(original, { compact:true });
  assert.deepEqual(out, { session: { id:'xyz',status:'completed',mode:'handoff',verified:false,completionSource:'user_report',timeoutAt:undefined }, visible:true, nextAction:'verify_in_app' });
  assert.equal(JSON.stringify(out).includes('Private'), false);
  assert.equal(formatToolResult({ session:null,pending:true }, {compact:true}).pending,true);
});
test('continuation distinguishes user report, refusal, missing target and pending guidance', () => {
  for (const compact of [true,false]) {
    const result = formatToolResult({session:{mode:'handoff',status:'completed',verified:false}}, {compact});
    assert.equal(result.nextAction,'verify_in_app');
    assert.equal(result.session.verified,false);
  }
  for (const status of ['declined','cancelled','expired','superseded'])
    assert.equal(continuationFor({status}),'stop');
  assert.equal(continuationFor({status:'awaiting_user',mode:'handoff'}),'wait_for_user');
  assert.equal(continuationFor({status:'awaiting_user',mode:'guide'}),'observe_app');
  assert.equal(continuationFor({status:'awaiting_user',targetTracking:{status:'lost'}}),'reobserve_target');
  assert.equal(continuationFor({status:'awaiting_user',targetTracking:{status:'lost',reason:'permission_denied'}}),'check_accessibility_permission');
});

test('compact results keep scene revision so an agent can patch again safely', () => {
  const source={session:{id:'0000',mode:'guide',status:'awaiting_user',timeoutAt:42,verified:false,sceneRevision:7,
    annotations:Array(12).fill({x:10,y:20})}};
  const result=formatToolResult(source,{compact:true});
  assert.equal(result.session.sceneRevision,7);
  assert.equal('annotations' in result.session,false);
});
