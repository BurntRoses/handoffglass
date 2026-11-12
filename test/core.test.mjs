import test from 'node:test';
import assert from 'node:assert/strict';
import { HandoffManager, normalizeAnnotation, normalizeRequest } from '../src/core.mjs';

const base = { title: 'Review access', message: 'Check requested privileges before proceeding.' };
const point = { x: 360, y: 190, shape: 'ring', label: 'Read this control' };

test('allows coordinate-free human handoff instead of inventing a target', () => {
  const m = new HandoffManager();
  const s = m.show({ ...base, mode: 'handoff' });
  assert.equal(s.annotations.length, 0);
  assert.equal(s.status, 'awaiting_user');
  assert.equal(s.verified, false);
  m.close();
});
test('rejects coordinate-free visual guidance', () => {
  assert.throws(() => normalizeRequest({ ...base, mode: 'guide' }), /requires grounded/);
});
test('validates coordinates and color, accepts negative global coordinates', () => {
  assert.equal(normalizeAnnotation({ x: -510, y: 27 }).x, -510);
  assert.throws(() => normalizeAnnotation({ x: Infinity, y: 0 }), /finite global/);
  assert.throws(() => normalizeAnnotation({ x: 100001, y: 0 }), /finite global/);
  assert.throws(() => normalizeAnnotation({ x: 1, y: 2, color: '<script>' }), /Color/);
  assert.throws(() => normalizeAnnotation({ x: 1, y: 2, shape: 'click' }), /shape/);
  assert.throws(() => normalizeAnnotation({ x: 1, y: 2, width: -50 }), /width/);
  assert.throws(() => normalizeRequest({ ...base, x: 1 }), /finite global/);
  assert.throws(() => normalizeRequest({ ...base, x: 1, y: 2, annotations: [] }), /not both/);
});
test('renders bounded multi-annotations and returns immutable copies', () => {
  const m = new HandoffManager();
  const s = m.show({ ...base, mode: 'guide', annotations: [point, { x: 800, y: 560, shape: 'box', width: 140, height: 70 }] });
  assert.equal(s.annotations.length, 2);
  s.annotations[0].x = 999;
  assert.equal(m.get(s.id).annotations[0].x, 360);
  assert.throws(() => normalizeRequest({ ...base, mode: 'guide', annotations: Array(9).fill(point) }), /at most 8/);
  m.close();
});
test('completed denotes user report only, never verified permission outcome', async () => {
  const m = new HandoffManager();
  const s = m.show({ ...base });
  const waiting = m.wait(s.id, 1000);
  const result = m.resolve(s.id, 'completed');
  assert.equal(result.session.status, 'completed');
  assert.equal(result.session.completionSource, 'user_report');
  assert.equal(result.session.verified, false);
  assert.equal((await waiting).session.status, 'completed');
  assert.equal(m.resolve(s.id, 'declined').error, 'already_final');
  m.close();
});
test('superseding preserves older result and rejects stale decisions', () => {
  const m = new HandoffManager();
  const old = m.show({ ...base });
  const current = m.show({ ...base, title: 'Next action' });
  assert.equal(m.get(old.id).status, 'superseded');
  assert.equal(m.active().id, current.id);
  assert.equal(m.resolve(old.id, 'completed').error, 'already_final');
  m.close();
});
test('expiration wins over late decisions', () => {
  let now = 1000;
  const m = new HandoffManager({ clock: () => now });
  const s = m.show({ ...base, timeoutSeconds: 10 });
  now = 11002;
  assert.equal(m.resolve(s.id, 'completed').session.status, 'expired');
  assert.equal(m.active(), null);
  m.close();
});
test('waiting returns pending and not false success', async () => {
  const m = new HandoffManager();
  const s = m.show({ ...base });
  const result = await m.wait(s.id, 8);
  assert.equal(result.pending, true);
  assert.equal(result.session.status, 'awaiting_user');
  m.close();
});
test('declined and cancelled are different terminal outcomes', () => {
  const m = new HandoffManager();
  assert.equal(m.resolve(m.show({ ...base }).id, 'declined').session.status, 'declined');
  assert.equal(m.resolve(m.show({ ...base, retryDeclined:true }).id, 'cancelled').session.status, 'cancelled');
  m.close();
});
test('terminal history is bounded', () => {
  const m = new HandoffManager({ maxHistory: 3 });
  const ids = [];
  for (let i = 0; i < 15; i++) {
    const s = m.show({ ...base, title: `Task ${i}` });
    m.resolve(s.id, 'cancelled');
    ids.push(s.id);
  }
  assert.ok(m.sessions.size <= 3);
  assert.equal(m.get(ids[0]), null);
  m.close();
});

test('a different agent cannot supersede or cancel another active session', () => {
  const m = new HandoffManager();
  const owned = m.show({ ...base }, 'first');
  assert.equal(m.show({ ...base }, 'second').error, 'busy');
  assert.equal(m.getOwned(owned.id, 'second'), null);
  assert.equal(m.resolve(owned.id, 'cancelled', 'second').error, 'not_found');
  const next = m.show({ ...base }, 'first');
  assert.equal(m.get(owned.id).status, 'superseded');
  assert.equal(m.get(next.id).status, 'awaiting_user');
  m.close();
});


test('idempotent retry returns same session without resetting expiration or sending another show', () => {
  const manager = new HandoffManager();
  let showCount = 0;
  manager.on('show', () => showCount++);
  const args = { mode: 'handoff', title: 'Check', message: 'Review authorization', requestId: 'retry-operation-0001' };
  const first = manager.show(args, 'agent-a');
  const retried = manager.show(args, 'agent-a');
  assert.equal(retried.id, first.id);
  assert.equal(retried.createdAt, first.createdAt);
  assert.equal(showCount, 1);
  assert.equal(manager.show(args, 'agent-b').error, 'busy');
  assert.throws(() => manager.show({ ...args, message: 'Different operation' }, 'agent-a'), /reused with different content/);
  manager.resolve(first.id, 'completed', 'agent-a');
  assert.equal(manager.show(args, 'agent-a').status, 'completed');
  manager.close();
});

test('bounded asynchronous waiters return overload instead of unlimited listeners', async () => {
  const manager = new HandoffManager();
  const session = manager.show({ mode: 'handoff', title: 'Check', message: 'Human action' }, 'agent-a');
  const waiting = Array.from({ length: 64 }, () => manager.waitOwned(session.id, 'agent-a', 30000));
  assert.equal(manager.pendingWaits, 64);
  assert.deepEqual(await manager.waitOwned(session.id, 'agent-a', 30000), { error: 'too_many_waits' });
  manager.resolve(session.id, 'declined', 'agent-a');
  const results = await Promise.all(waiting);
  assert.equal(results.every(x => x.session.status === 'declined'), true);
  assert.equal(manager.pendingWaits, 0);
  manager.close();
});

test('a declined handoff cannot be reissued with another request ID, position, style or timeout',()=>{
  const m=new HandoffManager();let shown=0;m.on('show',()=>shown++);
  try{
    const request={...base,sensitive:true,requestId:'refused-operation-1'};
    const original=m.show(request,'agent-a');m.resolve(original.id,'declined','agent-a');
    const refusal={error:'declined_by_user',nextAction:'respect_refusal'};
    assert.deepEqual(m.show(request,'agent-a'),refusal);
    assert.deepEqual(m.show({...request,requestId:'refused-operation-2',x:75,y:-40,visualStyle:'handdrawn',motion:'off',timeoutSeconds:10},'agent-a'),refusal);
    assert.equal(shown,1);assert.equal(m.active(),null);
    const other=m.show({...request,requestId:'refused-operation-3'},'agent-b');
    assert.equal(other.status,'awaiting_user');m.resolve(other.id,'cancelled','agent-b');
    assert.deepEqual(m.show({...request,requestId:'refused-operation-4'},'agent-a'),refusal);
  }finally{m.close();}
});

test('explicit user retry starts once, clears the old refusal and remains idempotent',()=>{
  const m=new HandoffManager();
  try{
    assert.equal(normalizeRequest(base).retryDeclined,false);
    assert.throws(()=>normalizeRequest({...base,retryDeclined:'yes'}),/retryDeclined/);
    const original=m.show({...base,requestId:'refused-before-retry'},'a');m.resolve(original.id,'declined','a');
    const retry={...base,requestId:'explicit-user-retry',retryDeclined:true};
    const restarted=m.show(retry,'a');assert.equal(restarted.status,'awaiting_user');assert.notEqual(restarted.id,original.id);
    assert.equal(m.refusals.size,0);assert.equal(m.show(retry,'a').id,restarted.id);
    assert.throws(()=>m.show({...retry,retryDeclined:false},'a'),/reused with different content/);
    m.resolve(restarted.id,'cancelled','a');
    assert.equal(m.show({...base,requestId:'after-explicit-retry'},'a').status,'awaiting_user');
  }finally{m.close();}
});

test('a retry blocked by another owner does not clear a refusal',()=>{
  const m=new HandoffManager();
  try{
    const original=m.show(base,'a');m.resolve(original.id,'declined','a');
    const other=m.show({...base,title:'Another operation'},'b');
    assert.equal(m.show({...base,retryDeclined:true},'a').error,'busy');
    m.resolve(other.id,'cancelled','b');
    assert.deepEqual(m.show(base,'a'),{error:'declined_by_user',nextAction:'respect_refusal'});
  }finally{m.close();}
});

test('refusal fingerprints are bounded, contain no task text and are cleared on close',()=>{
  const m=new HandoffManager({maxHistory:3});
  try{
    for(let i=0;i<8;i++){
      const session=m.show({...base,title:'Private operation '+i},'private-owner');m.resolve(session.id,'declined','private-owner');
      assert.ok(m.refusals.size<=3);
    }
    assert.equal(m.refusals.size,3);
    assert.ok([...m.refusals.keys()].every(key=>/^[a-f0-9]{64}$/.test(key)));
    assert.equal(m.show({...base,title:'Private operation 0'},'private-owner').status,'awaiting_user');
    assert.equal(m.exportCheckpoint(),null);
  }finally{m.close();}
  assert.equal(m.refusals.size,0);
});

test('next-step presentation respects refusals and only clears them after a valid explicit retry',()=>{
  const m=new HandoffManager();
  try{
    const original=m.show(base,'a');m.resolve(original.id,'declined','a');
    const task=m.show({...base,title:'Check another step',continuous:true},'a');
    assert.equal(m.present(task.id,{...base,retryDeclined:true},'a').error,'step_not_verified');
    assert.equal(m.refusals.size,1);
    m.resolve(task.id,'completed','a');m.verify(task.id,'a',true);
    const blocked=m.present(task.id,{...base,requestId:'refused-in-next-step'},'a');
    assert.deepEqual(blocked,{error:'declined_by_user',nextAction:'respect_refusal'});
    assert.equal(m.get(task.id).phase,'next_step');assert.equal(m.get(task.id).step,1);
    const retry={...base,requestId:'explicit-next-step-retry',retryDeclined:true};
    const next=m.present(task.id,retry,'a').session;
    assert.equal(next.id,task.id);assert.equal(next.step,2);assert.equal(next.status,'awaiting_user');
    assert.equal(m.refusals.size,0);assert.equal(m.present(task.id,retry,'a').session.step,2);
    m.resolve(task.id,'declined','a');
    assert.deepEqual(m.present(task.id,retry,'a'),{error:'declined_by_user',nextAction:'respect_refusal'});
    assert.deepEqual(m.show({...base,requestId:'declined-next-step-again'},'a'),{error:'declined_by_user',nextAction:'respect_refusal'});
  }finally{m.close();}
});
