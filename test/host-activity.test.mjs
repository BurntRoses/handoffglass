import test from 'node:test';
import assert from 'node:assert/strict';
import {HostActivity,classifyHost} from '../src/local/host-activity.mjs';
import {HandoffManager} from '../src/core.mjs';
import {LocalBridge} from '../src/bridge.mjs';
import {summarizeDiagnostics} from '../src/desktop/center-model.mjs';

test('activity is bounded, ephemeral, fixed vocabulary, never stores a task',()=>{
  let now=1000000;
  const activity=new HostActivity({now:()=>now});
  assert.equal(classifyHost('cursor'), 'cursor');
  assert.equal(classifyHost('../../private'), 'unidentified');
  activity.record('cursor','/agent/show');
  activity.record('cursor','/agent/wait');
  activity.record('unknown-agent-🔒','/agent/locate');
  activity.record('workbuddy','/desktop/diagnostics');
  const snapshot=activity.snapshot();
  assert.deepEqual(snapshot.map(s=>s.host),['unidentified','cursor']);
  assert.equal(snapshot[1].calls,2);
  assert.equal(snapshot[1].lastAction,'wait');
  assert.doesNotMatch(JSON.stringify(snapshot),/password|private|taskText|owner/);
  now+=900001;
  assert.deepEqual(activity.snapshot(),[]);
});

test('host attribution is recorded ONLY after scoped authenticated calls',async()=>{
  const manager=new HandoffManager(), bridge=new LocalBridge(manager,{headless:true});
  await bridge.start();
  const url=`http://127.0.0.1:${bridge.port}`;
  const base={authorization:`Bearer ${bridge.agentToken}`,'x-handoffglass-owner':'11111111-1111-4111-8111-111111111111',
    'x-handoffglass-host':'workbuddy'};
  try {
    assert.equal((await fetch(url+'/agent/displays',{headers:{...base, authorization:'Bearer nope'}})).status,401);
    assert.deepEqual(bridge.hostActivity.snapshot(),[]);
    assert.equal((await fetch(url+'/agent/displays',{headers:base})).status,200);
    const res=await fetch(url+'/desktop/diagnostics',{headers:{authorization:`Bearer ${bridge.token}`}});
    const diag=await res.json();
    assert.deepEqual(diag.hostActivity.map(s=>s.host),['workbuddy']);
    assert.ok(!JSON.stringify(diag).includes(base['x-handoffglass-owner']));
    const summary=summarizeDiagnostics(diag);
    assert.equal(summary.hosts[0].attribution,'config_declared');
    assert.equal(summary.hosts[0].calls,1);
  } finally {await bridge.stop();manager.close();}
});
