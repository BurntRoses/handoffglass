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
  assert.equal(m.resolve(m.show({ ...base }).id, 'cancelled').session.status, 'cancelled');
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
