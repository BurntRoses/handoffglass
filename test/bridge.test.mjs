import test from 'node:test';
import assert from 'node:assert/strict';
import { HandoffManager } from '../src/core.mjs';
import { LocalBridge } from '../src/bridge.mjs';

async function fixture(fn) {
  const manager = new HandoffManager();
  const bridge = new LocalBridge(manager);
  await bridge.start();
  const url = `http://127.0.0.1:${bridge.port}`;
  const request = (path, { method = 'GET', body, headers = {} } = {}) => fetch(url + path, {
    method, body: body === undefined ? undefined : JSON.stringify(body),
    headers: { authorization: `Bearer ${bridge.token}`, 'content-type': 'application/json', ...headers }
  });
  try { return await fn({ manager, bridge, request, url }); }
  finally { await bridge.stop(); manager.close(); }
}
const basic = { title: 'Read permissions', message: 'Make your own decision', mode: 'handoff' };

test('secret-protected loopback bridge and strict headers', async () => fixture(async ({ bridge, request, url }) => {
  assert.equal(bridge.server.address().address, '127.0.0.1');
  assert.equal((await fetch(url + '/state')).status, 401);
  assert.equal((await request('/state', { headers: { origin: 'https://evil.example' } })).status, 403);
  assert.equal((await request('/hello', { method: 'POST', body: {}, headers: { 'content-type': 'text/plain' } })).status, 415);
  assert.equal((await request('/hello', { method: 'POST', body: { displays: [{ id: '1', x: 0, y: 0, width: 1920, height: 1080 }] } })).status, 200);
  assert.equal(bridge.displays.length, 1);
}));

test('poll returns newest snapshot, never replays stale show messages', async () => fixture(async ({ manager, request }) => {
  const first = manager.show(basic);
  const second = manager.show({ ...basic, title: 'Updated request' });
  const result = await (await request('/poll?after=0')).json();
  assert.equal(result.active.id, second.id);
  assert.notEqual(result.active.id, first.id);
  assert.ok(result.revision >= 3);
  const old = await request('/decision', { method: 'POST', body: { id: first.id, status: 'completed' } });
  assert.equal(old.status, 409);
}));

test('long-poll listeners receive a fresh state and remove themselves', async () => fixture(async ({ manager, bridge, request }) => {
  const hello = await (await request('/hello', { method: 'POST', body: { displays: [] } })).json();
  const waitingA = request(`/poll?after=${hello.revision}`).then(r => r.json());
  const waitingB = request(`/poll?after=${hello.revision}`).then(r => r.json());
  await new Promise(resolve => setTimeout(resolve, 40));
  const s = manager.show(basic);
  assert.equal((await waitingA).active.id, s.id);
  assert.equal((await waitingB).active.id, s.id);
  assert.equal(bridge.waiters.size, 0);
  const decision = await request('/decision', { method: 'POST', body: { id: s.id, status: 'completed' } });
  assert.equal(decision.status, 200);
  assert.equal((await (await request('/state')).json()).active, null);
}));

test('rejects malformed screens, decisions, and overlarge bodies', async () => fixture(async ({ manager, request }) => {
  assert.equal((await request('/hello', { method: 'POST', body: { displays: [{ x: 0, y: 0, width: 100, height: 100 }] } })).status, 400);
  const s = manager.show(basic);
  assert.equal((await request('/decision', { method: 'POST', body: { id: s.id, status: 'approve' } })).status, 400);
  assert.equal((await request('/decision', { method: 'POST', body: { id: s.id, status: 'declined' } })).status, 200);
  assert.equal(manager.get(s.id).status, 'declined');
  assert.equal((await request('/hello', { method: 'POST', body: { displays: [], noisy: 'x'.repeat(20000) } })).status, 413);
}));

test('rejects route method confusion without touching session state', async () => fixture(async ({ manager, request }) => {
  const s = manager.show(basic);
  assert.equal((await request('/decision?id=' + s.id)).status, 405);
  assert.equal((await request('/state', { method: 'POST', body: {} })).status, 405);
  assert.equal((await request('/agent/show')).status, 405);
  assert.equal(manager.get(s.id).status, 'awaiting_user');
}));

test('bounds concurrent long polls to protect the loopback broker', async () => fixture(async ({ request, bridge }) => {
  const hello = await (await request('/hello', { method: 'POST', body: { displays: [] } })).json();
  const ctl = new AbortController();
  const url = `http://127.0.0.1:${bridge.port}/poll?after=${hello.revision}`;
  const pending = Array.from({ length: 128 }, () => fetch(url, {
    headers: { authorization: `Bearer ${bridge.token}` }, signal: ctl.signal
  }).catch(() => null));
  try {
    const until = Date.now() + 4000;
    while (bridge.waiters.size < 128 && Date.now() < until) await new Promise(r => setTimeout(r, 15));
    assert.equal(bridge.waiters.size, 128);
    assert.equal((await request(`/poll?after=${hello.revision}`)).status, 503);
  } finally {
    ctl.abort();
    await Promise.all(pending);
  }
}));

test('authenticated agent bridge deduplicates retries and separates owner access', async () => fixture(async ({ request, bridge }) => {
  bridge.headless = true; // Protocol-only fixture: no physical screen is claimed.
  const ownerA = { authorization: `Bearer ${bridge.agentToken}`, 'x-handoffglass-owner': '11111111-1111-4111-8111-111111111111' };
  const ownerB = { authorization: `Bearer ${bridge.agentToken}`, 'x-handoffglass-owner': '22222222-2222-4222-8222-222222222222' };
  const args = { ...basic, requestId: 'bridge-retry-00001' };
  const send = headers => request('/agent/show', { method: 'POST', headers, body: args });
  const first = await (await send(ownerA)).json();
  assert.equal(first.session.verified, false);
  assert.equal(first.visible, false);
  const repeat = await (await send(ownerA)).json();
  assert.equal(repeat.session.id, first.session.id);
  assert.equal((await send(ownerB)).status, 409);
  const privateStatus = await (await request(`/agent/status?sessionId=${first.session.id}`, { headers: ownerB })).json();
  assert.equal(privateStatus.session, null);
  const changed = await request('/agent/show', { method: 'POST', headers: ownerA, body: { ...args, title: 'Changed' } });
  assert.equal(changed.status, 400);
  const cancel = await (await request('/agent/cancel', { method: 'POST', headers: ownerA,
    body: { sessionId: first.session.id } })).json();
  assert.equal(cancel.session.status, 'cancelled');
  const finalRetry = await (await send(ownerA)).json();
  assert.equal(finalRetry.session.status, 'cancelled');
}));
