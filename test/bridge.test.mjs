import test from 'node:test';
import assert from 'node:assert/strict';
import { HandoffManager } from '../src/core.mjs';
import { LocalBridge } from '../src/bridge.mjs';
import { GroundingError } from '../src/visual/grounding.mjs';

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
test('foreground inspection requires agent capability and owner, with no result in diagnostics',async()=>fixture(async({bridge,request})=>{
  bridge.headless=true;
  const observation={app:'Fixture',controls:[{app:'Fixture',role:'button',name:'Private control'}]};
  let count=0;
  bridge.inspector=async()=>{count++;return observation;};
  assert.equal((await request('/agent/inspect')).status,401);
  const auth={authorization:`Bearer ${bridge.agentToken}`};
  assert.equal((await request('/agent/inspect',{headers:auth})).status,403);
  const headers={...auth,'x-handoffglass-owner':'11111111-1111-4111-8111-111111111111'};
  const response=await request('/agent/inspect',{headers});
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),observation);
  assert.equal(count,1);
  const diagnostics=await (await request('/desktop/diagnostics')).text();
  assert.equal(diagnostics.includes('Private control'),false);
}));

test('native failures retain actionable codes across the authenticated bridge', async () => fixture(async ({ bridge, request }) => {
  bridge.headless = true;
  const target = { app: 'Fixture', role: 'button', name: 'Locate target' };
  const headers = { authorization: `Bearer ${bridge.agentToken}`,
    'x-handoffglass-owner': '11111111-1111-4111-8111-111111111111' };
  for (const code of ['consent_required', 'permission_denied', 'app_not_frontmost', 'target_not_found']) {
    bridge.locator = async () => { throw new GroundingError(code, 'Fixture native failure'); };
    for (const path of ['/agent/locate', '/agent/show']) {
      const response = await request(path, { method: 'POST', headers,
        body: { ...basic, target } });
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { error: 'Fixture native failure', code });
    }
  }
}));

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

test('agent scene updates are owner-scoped, versioned and revision-published', async () => fixture(async ({ request, bridge, manager }) => {
  bridge.headless = true;
  const ownerA = { authorization: `Bearer ${bridge.agentToken}`, 'x-handoffglass-owner': '11111111-1111-4111-8111-111111111111' };
  const ownerB = { authorization: `Bearer ${bridge.agentToken}`, 'x-handoffglass-owner': '22222222-2222-4222-8222-222222222222' };
  const session = (await (await request('/agent/show', {method:'POST',headers:ownerA,body:{...basic,
    scene:{version:1,layers:[{id:'target',annotations:[{id:'mark_1',x:50,y:80,shape:'ring'}]}]}}})).json()).session;
  assert.equal(session.sceneRevision,1);
  const before = bridge.revision;
  const args = {sessionId:session.id,expectedRevision:1,
    operations:[{op:'set_layer',layerId:'target',visible:false}]};
  const send = (headers,body=args) => request('/agent/scene', {method:'POST',headers,body});
  assert.equal((await send(ownerB)).status,404);
  assert.equal((await request('/agent/scene',{headers:ownerA})).status,405);
  const updated = await (await send(ownerA)).json();
  assert.equal(updated.session.sceneRevision,2);
  assert.equal(updated.session.annotations.length,0);
  assert.equal(bridge.revision,before+1);
  assert.equal((await send(ownerA)).status,409);
  const bad = await send(ownerA,{sessionId:session.id,expectedRevision:2,operations:[{op:'remove_layer',layerId:'not_real'}]});
  assert.equal(bad.status,400);
  assert.equal(manager.get(session.id).sceneRevision,2);
  assert.equal(manager.get(session.id).verified,false);
  manager.resolve(session.id,'declined');
  assert.equal((await send(ownerA,{...args,expectedRevision:2})).status,409);
}));

test('rejects offscreen scene updates without modifying displayed targets', async () => fixture(async ({ request, bridge, manager }) => {
  bridge.headless=true;
  const owner = { authorization:`Bearer ${bridge.agentToken}`, 'x-handoffglass-owner':'11111111-1111-4111-8111-111111111111' };
  const session=(await (await request('/agent/show',{method:'POST',headers:owner,body:{...basic,
    scene:{version:1,layers:[{id:'one',annotations:[{id:'a',x:30,y:30,shape:'ring'}]}]}}})).json()).session;
  bridge.headless=false;
  bridge.displays=[{id:'main',x:0,y:0,width:100,height:100,scaleFactor:1}];
  bridge.lastPoll=Date.now(); // Simulate a currently connected renderer for bounds-only test.
  const res=await request('/agent/scene',{method:'POST',headers:owner,body:{sessionId:session.id,expectedRevision:1,
    operations:[{op:'upsert_annotation',layerId:'one',annotation:{id:'b',x:999,y:50}}]}});
  assert.equal(res.status,422);
  assert.equal(manager.get(session.id).sceneRevision,1);
}));


test('scene mutations fail closed when the actual overlay is unavailable', async()=>fixture(async({request,bridge,manager})=>{
  bridge.headless=true;
  const owner={authorization:`Bearer ${bridge.agentToken}`,'x-handoffglass-owner':'11111111-1111-4111-8111-111111111111'};
  const result=await (await request('/agent/show',{method:'POST',headers:owner,body:{...basic,
    scene:{version:1,layers:[{id:'layer',annotations:[{id:'mark',x:30,y:30}]}]}}})).json();
  const id=result.session.id;
  bridge.headless=false;
  bridge.lastPoll=0;
  const updated=await request('/agent/scene',{method:'POST',headers:owner,body:{sessionId:id,expectedRevision:1,
    operations:[{op:'set_layer',layerId:'layer',visible:false}]}});
  assert.equal(updated.status,503);
  assert.equal((await updated.json()).code,'no_desktop');
  assert.equal(manager.get(id).sceneRevision,1);
}));

test('native exact-match target feeds the existing owned handoff without permitting guessed or mixed coordinates',async()=>{
  const manager=new HandoffManager();
  const spy=[];
  const bridge=new LocalBridge(manager,{locator:async q=>{spy.push(q);return {x:60,y:55,width:30,height:20,source:'uia',coordinateSpace:'global_DIP'};}});
  await bridge.start();
  bridge.displays=[{id:'mock',x:0,y:0,width:200,height:100,scaleFactor:1}];
  bridge.lastPoll=Date.now();
  const url=`http://127.0.0.1:${bridge.port}`;
  const headers={authorization:`Bearer ${bridge.agentToken}`,'x-handoffglass-owner':'11111111-1111-4111-8111-111111111111','content-type':'application/json'};
  const req=(path,body)=>fetch(url+path,{method:'POST',headers,body:JSON.stringify(body)});
  const target={app:'chrome',role:'button',name:'Allow'};
  try {
    assert.equal((await req('/agent/show',{title:'Test',message:'Please decide',mode:'handoff',target,x:50})).status,400);
    const result=await (await req('/agent/show',{title:'Test',message:'Please decide',mode:'handoff',target})).json();
    assert.equal(result.session.annotations[0].x,60);
    assert.equal(result.session.verified,false);
    assert.deepEqual(spy,[target]);
    const locate=await (await req('/agent/locate',{target})).json();
    assert.equal(locate.target.x,60);
  } finally { await bridge.stop(); manager.close(); }
});

test('target requestId retries do not re-inspect UI or reset human handoff', async()=>{
  const manager=new HandoffManager();let lookups=0;
  const bridge=new LocalBridge(manager,{locator:async()=>({x:++lookups*40,y:20,width:30,height:20})});
  await bridge.start();bridge.displays=[{id:'screen',x:0,y:0,width:300,height:300}];bridge.lastPoll=Date.now();
  const headers={ authorization:`Bearer ${bridge.agentToken}`,'x-handoffglass-owner':'11111111-1111-4111-8111-111111111111', 'content-type':'application/json' };
  const url=`http://127.0.0.1:${bridge.port}/agent/show`;
  const request={title:'Decide',message:'Please review',mode:'handoff',requestId:'native-target-retry-1',target:{app:'chrome',role:'button',name:'OK'}};
  try {
    const post=body=>fetch(url,{method:'POST',headers,body:JSON.stringify(body)});
    const first=(await (await post(request)).json()).session;
    const second=(await (await post(request)).json()).session;
    assert.equal(first.id,second.id);
    assert.equal(first.timeoutAt,second.timeoutAt);
    assert.equal(first.annotations[0].x,second.annotations[0].x);
    assert.equal(lookups,1);
    assert.equal((await post({...request,title:'Changed'})).status,400);
  } finally { await bridge.stop();manager.close(); }
});
