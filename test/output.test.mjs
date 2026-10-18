import test from 'node:test';
import assert from 'node:assert/strict';
import { formatToolResult } from '../src/output.mjs';
test('default response preserves full contract and detailed display scale', () => {
  const original = { displays: [{ id:'primary', x:0, y:0, width:1200, height:800, scaleFactor:2 }], connected:true };
  assert.equal(formatToolResult(original), original);
});
test('compact response strips prose and repeated annotations but keeps important outcome', () => {
  const original = { session: { id:'xyz', status:'completed', mode:'handoff', verified:false, completionSource:'user_report',
    title:'Private', message:'a'.repeat(999), annotations: [{ x:3,y:7 }] }, visible:true,
    instruction:'user confirmation is not independent verification' };
  const out = formatToolResult(original, { compact:true });
  assert.deepEqual(out, { session: { id:'xyz',status:'completed',mode:'handoff',verified:false,completionSource:'user_report',timeoutAt:undefined }, visible:true });
  assert.equal(JSON.stringify(out).includes('Private'), false);
  assert.equal(formatToolResult({ session:null,pending:true }, {compact:true}).pending,true);
});
