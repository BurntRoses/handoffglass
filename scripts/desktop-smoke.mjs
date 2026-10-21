#!/usr/bin/env node
/** Real Electron startup regression: requires an interactive macOS/Windows desktop. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, readdir, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { readManifest, probe } from '../src/runtime.mjs';
import { savePreferences } from '../src/local/preferences.mjs';
import { packagedRuntime } from '../src/release-contract.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packaged = process.argv.includes('--packaged');
let electron, entryRoot = root;
if (packaged) {
  const dist = resolve(process.env.HANDOFFGLASS_DIST_DIR || `dist/desktop-${process.platform}-${process.arch}`);
  const runtime = await packagedRuntime(dist);
  electron = runtime.binary;
  entryRoot = join(runtime.resources, 'app.asar');
  await access(electron);
} else electron = (await import('electron')).default;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const decode = result => {
  assert.ok(!result.isError, result.content?.map(c => c.text || '').join('; '));
  return JSON.parse(result.content.find(c => c.type === 'text').text);
};

async function smoke(mode) {
  const dir = await mkdtemp(join(tmpdir(), 'handoffglass-desktop-'));
  const env = { ...process.env, HANDOFFGLASS_RUNTIME_DIR: dir,
    HANDOFFGLASS_HEADLESS: '0', HANDOFFGLASS_HOST_ID: 'codex' };
  delete env.ELECTRON_RUN_AS_NODE;
  const clients = [];
  let desktop;
  let info;
  const started = performance.now();
  try {
    // Suppress onboarding only in this disposable test runtime.
    await savePreferences({}, dir);
    if (mode === 'app') {
      desktop = spawn(electron, [...(packaged ? [] : [root]), `--user-data-dir=${join(dir, 'electron-data')}`],
        { env, stdio: ['ignore', 'ignore', 'pipe'] });
      let launchError;
      desktop.on('error', error => { launchError = error; });
      desktop.stderr.on('data', chunk => process.stderr.write(chunk));
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        if (launchError) throw launchError;
        assert.ok(desktop.exitCode === null && desktop.signalCode === null, 'App exited before ready');
        info = await readManifest(dir);
        if (info && await probe(info)) break;
        await pause(100);
      }
      assert.ok(info && await probe(info), 'Electron app did not publish a live Broker within 15s');
      assert.equal(info.pid, desktop.pid, 'Standalone app must host its own Broker');
    }
    async function connect(name) {
      const client = new Client({ name, version: '0.15.0' });
      clients.push(client);
      const useElectron = packaged || mode === 'electron-mcp';
      await client.connect(new StdioClientTransport({ command: useElectron ? electron : process.execPath,
        args: [join(entryRoot, 'src/mcp.mjs')],
        env: {...env, ...(useElectron ? {ELECTRON_RUN_AS_NODE: '1'} : {})}, stderr: 'pipe' }));
      return client;
    }
    const first = await connect('desktop-smoke-A');
    const invoke = async (client, name, args = {}) => decode(await client.callTool({ name, arguments: args }));
    const displays = await invoke(first, 'screen_displays');
    assert.equal(displays.headless, false);
    assert.equal(displays.connected, true);
    assert.ok(displays.displays.length > 0, 'No real Electron displays attached');
    info = await readManifest(dir);
    const second = await connect('desktop-smoke-B');
    await invoke(second, 'screen_displays');
    assert.equal((await readManifest(dir)).pid, info.pid, 'Two MCP clients must share one Broker');
    const d = displays.displays[0];
    const shown = await invoke(first, 'session_start', {mode:'guide', title: 'HandoffGlass startup check',
      message: 'Synthetic display test point', requestId: `desktop-smoke-${mode}`,
      annotations: [{ x: d.x + d.width / 2, y: d.y + d.height / 2,
        shape: 'ring', width: 80, height: 50, label: 'Startup check' }], timeoutSeconds: 30 });
    assert.equal(shown.visible, true);
    assert.equal(shown.session.status, 'awaiting_user');
    assert.equal((await second.callTool({name:'session_wait',arguments:{sessionId:shown.session.id,maxWaitSeconds:0}})).isError,true);
    await pause(250);
    const cancelled = await invoke(first, 'session_stop', {sessionId: shown.session.id});
    assert.equal(cancelled.session.status, 'cancelled');
    console.log(`PASS ${packaged ? 'packaged ' : ''}${mode}: ${displays.displays.length} real display(s), two MCP clients, shared Broker, visual/cancel (${Math.round(performance.now() - started)}ms)`);
  } finally {
    for (const client of clients) await client.close().catch(() => {});
    info = await readManifest(dir);
    if (info) { try { process.kill(info.pid, 'SIGTERM'); } catch {} }
    if (desktop && desktop.exitCode === null && desktop.signalCode === null) {
      desktop.kill();
      await Promise.race([once(desktop, 'close'), pause(3000)]);
    }
    for (let i = 0; i < 30 && await readManifest(dir); i++) await pause(100);
    await rm(dir, {recursive: true, force: true, maxRetries: 12, retryDelay: 250});
  }
}

for (const mode of packaged ? ['app', 'electron-mcp'] : ['broker', 'app', 'electron-mcp']) await smoke(mode);
if (!packaged) {
  const windowEnv = { ...process.env };
  delete windowEnv.ELECTRON_RUN_AS_NODE;
  const windows = spawn(electron, [join(root, 'scripts/desktop-window-smoke.mjs')], {
    env: windowEnv, stdio: 'inherit'
  });
  const timeout = setTimeout(() => windows.kill(), 20000);
  try {
    const [code, signal] = await once(windows, 'exit');
    assert.equal(code, 0, `Window regression failed (${signal || code})`);
  } finally { clearTimeout(timeout); }
}
console.log('Human decisions, native target accuracy and multi-display behavior still require desktop QA.');
