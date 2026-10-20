import test from 'node:test';
import assert from 'node:assert/strict';
import { HandoffManager } from '../src/core.mjs';
import { LocalBridge } from '../src/bridge.mjs';
import { CAPABILITY_MANIFEST } from '../src/capabilities.mjs';
import { installCodex } from '../src/codex-install.mjs';
import { integrationStatus, cleanupIntegration } from '../src/integration-lifecycle.mjs';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const owner = '33333333-3333-4333-8333-333333333333';
const body = { title: '连续引导', message: '请检查当前窗口', x: 30, y: 30, mode: 'handoff' };

test('continuous sessions expose a phase and independent verification', () => {
  const manager = new HandoffManager();
  const session = manager.show(body, owner);
  assert.equal(session.phase, 'waiting_user');
  assert.equal(session.nextAction, 'wait_for_user');
  manager.resolve(session.id, 'completed', owner);
  assert.equal(manager.get(session.id).phase, 'verifying');
  const checked = manager.verify(session.id, owner, true);
  assert.equal(checked.session.phase, 'complete');
  assert.equal(checked.session.verified, true);
  manager.close();
});

test('capability and session wait endpoints return cursor-safe state', async () => {
  const manager = new HandoffManager();
  const bridge = new LocalBridge(manager, { headless: true });
  await bridge.start();
  const url = `http://127.0.0.1:${bridge.port}`;
  const headers = { authorization: `Bearer ${bridge.agentToken}`, 'x-handoffglass-owner': owner, 'content-type': 'application/json' };
  try {
    const capabilities = await (await fetch(url + '/agent/capabilities', { headers })).json();
    assert.equal(capabilities.manifest.version, CAPABILITY_MANIFEST.version);
    const created = await (await fetch(url + '/agent/show', { method: 'POST', headers, body: JSON.stringify(body) })).json();
    const waited = await (await fetch(url + `/agent/wait?sessionId=${created.session.id}&maxWaitMs=0`, { headers })).json();
    assert.equal(waited.session.phase, 'waiting_user');
    const events = await (await fetch(url + `/agent/events?sessionId=${created.session.id}&after=0`, { headers })).json();
    assert.equal(events.events[0].type, 'started');
    assert.equal(typeof events.events[0].sequence, 'number');
  } finally { await bridge.stop(); manager.close(); }
});

test('integration cleanup is dry-run first and preserves unrelated Codex settings', async () => {
  const home = await mkdtemp(join(tmpdir(), 'hg-lifecycle-'));
  const codexHome = join(home, '.codex');
  try {
    await mkdir(codexHome, { recursive: true });
    await writeFile(join(codexHome, 'config.toml'), 'model = "keep"\n');
    await installCodex({ userHome: home, codexHome, apply: true });
    assert.equal((await integrationStatus('codex', { userHome: home, codexHome })).state, 'installed');
    const preview = await cleanupIntegration('codex', { userHome: home, codexHome });
    assert.equal(preview.confirmationRequired, true);
    const applied = await cleanupIntegration('codex', { userHome: home, codexHome, confirm: true });
    assert.equal(applied.applied, true);
    assert.equal(await readFile(join(codexHome, 'config.toml'), 'utf8'), 'model = "keep"\n');
  } finally { await rm(home, { recursive: true, force: true }); }
});
