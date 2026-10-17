import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { BrokerClient, ensureBroker, readManifest, probe } from '../src/runtime.mjs';

const request = { title: 'Review permissions', message: 'A human must decide', timeoutSeconds: 30 };
async function fixture(run) {
  const dir = await mkdtemp(join(tmpdir(), 'handoffglass-test-'));
  const env = { ...process.env, HANDOFFGLASS_RUNTIME_DIR: dir, HANDOFFGLASS_HEADLESS: '1' };
  let pid;
  try {
    const info = await ensureBroker({ env });
    pid = info.pid;
    return await run({ env, dir, info });
  } finally {
    if (pid) { try { process.kill(pid, 'SIGTERM'); } catch {} }
    if (pid) for (let i = 0; i < 40; i++) {
      const m = await readManifest(dir);
      if (!m || !await probe(m)) break;
      await new Promise(r => setTimeout(r, 50));
    }
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}
test('one authenticated broker serves concurrent MCP clients and isolates ownership', async () => fixture(async ({ env, info }) => {
  const a = new BrokerClient({ env });
  const b = new BrokerClient({ env });
  const three = await Promise.all([ensureBroker({ env }), ensureBroker({ env }), ensureBroker({ env })]);
  assert.ok(three.every(c => c.pid === info.pid));
  assert.equal((await a.displays()).headless, true);
  const first = await a.present('handoff', request);
  assert.equal(first.visible, false);
  await assert.rejects(() => b.present('handoff', request), error => error.code === 'busy' && error.httpCode === 409);
  const forbiddenStatus = await b.status(first.session.id);
  assert.equal(forbiddenStatus.session, null);
  assert.equal((await b.cancel(first.session.id)).error, 'not_found');
  assert.equal((await b.wait(first.session.id, 0)).error, 'not_found');
  assert.equal((await a.status(first.session.id)).session.status, 'awaiting_user');
  assert.equal((await a.cancel(first.session.id)).session.status, 'cancelled');
  assert.equal((await b.present('handoff', request)).session.status, 'awaiting_user');
}));
test('broker enforces desktop/agent credential separation and private metadata', async () => fixture(async ({ dir, info, env }) => {
  const metadata = await readManifest(dir);
  assert.equal(metadata.pid, info.pid);
  if (process.platform !== 'win32') {
    assert.equal((await stat(dir)).mode & 0o077, 0);
    assert.equal((await stat(join(dir, 'broker.json'))).mode & 0o077, 0);
  }
  const base = `http://127.0.0.1:${info.port}`;
  assert.equal((await fetch(base + '/hello', { method: 'POST', headers: { authorization: `Bearer ${info.token}`, 'content-type': 'application/json' }, body: JSON.stringify({ displays: [] }) })).status, 401);
  assert.equal((await fetch(base + '/agent/displays', { headers: { authorization: `Bearer ${info.token}` } })).status, 403);
  assert.equal((await fetch(base + '/health', { headers: { authorization: `Bearer ${info.token}` } })).status, 200);
  assert.equal((await fetch(base + '/health', { headers: { authorization: `Bearer ${info.token}`, origin: 'https://evil.test' } })).status, 403);
  assert.equal((await readFile(join(dir, 'broker.json'), 'utf8')).includes('desktopToken'), false);
}));
test('broker restarts from a stale manifest and retains no old user session', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'handoffglass-recovery-'));
  const env = { ...process.env, HANDOFFGLASS_RUNTIME_DIR: dir, HANDOFFGLASS_HEADLESS: '1' };
  let pid;
  try {
    const first = await ensureBroker({ env });
    pid = first.pid;
    const c = new BrokerClient({ env });
    const s = await c.present('handoff', request);
    process.kill(pid, 'SIGTERM');
    for (let i = 0; i < 60; i++) {
      if (!await probe(first)) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    const second = await ensureBroker({ env });
    pid = second.pid;
    assert.notEqual(first.pid, second.pid);
    assert.equal((await c.status(s.session.id)).session, null);
  } finally {
    if (pid) { try { process.kill(pid, 'SIGTERM'); } catch {} }
    if (pid) for (let i = 0; i < 40; i++) {
      const m = await readManifest(dir);
      if (!m || !await probe(m)) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
