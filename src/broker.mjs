#!/usr/bin/env node
/** A single local desktop broker that outlives individual MCP stdio clients. */
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rm } from 'node:fs/promises';
import { HandoffManager } from './core.mjs';
import { LocalBridge } from './bridge.mjs';
import { runtimeDir, secureRuntimeDir, readManifest, writeManifest } from './runtime.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = await secureRuntimeDir(runtimeDir());
const manager = new HandoffManager();
let desktop = null, starting = null, ending = false;
const headless = process.env.HANDOFFGLASS_HEADLESS === '1';
const nap = ms => new Promise(resolve => setTimeout(resolve, ms));

async function launchDesktop(bridge) {
  if (headless) return;
  if (bridge.connected && desktop && desktop.exitCode === null && desktop.signalCode === null) return;
  if (starting) return starting;
  starting = (async () => {
    if (!desktop || desktop.exitCode !== null || desktop.signalCode !== null) {
      bridge.lastPoll = 0; // Require a fresh /hello from the replacement renderer.
      let executable = process.env.HANDOFFGLASS_ELECTRON;
      if (!executable) {
        try { executable = (await import('electron')).default; }
        catch { throw new Error('Electron is not installed: run npm install'); }
      }
      desktop = spawn(executable, [resolve(root, 'src/desktop/main.mjs')], {
        env: { ...process.env, HANDOFFGLASS_PORT: String(bridge.port), HANDOFFGLASS_SECRET: bridge.token },
        stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true
      });
      desktop.stderr?.on('data', chunk => process.stderr.write(`[handoffglass desktop] ${String(chunk).slice(0, 1500)}`));
      desktop.on('error', error => process.stderr.write(`[handoffglass desktop] ${error.message}\n`));
    }
    for (let i = 0; i < 75; i++) {
      if (bridge.connected && desktop?.exitCode === null && desktop?.signalCode === null) return;
      if (desktop && (desktop.exitCode !== null || desktop.signalCode !== null)) break;
      await nap(120);
    }
    if (desktop?.exitCode === null) desktop.kill();
    throw new Error('Desktop did not connect; a graphical desktop session and Electron are required');
  })();
  try { await starting; } finally { starting = null; }
}

const bridge = new LocalBridge(manager, { prepare: () => launchDesktop(bridge), headless });
await bridge.start();
await writeManifest(dir, { port: bridge.port, token: bridge.agentToken, pid: process.pid, startedAt: Date.now(), protocol: 1 });

async function shutdown() {
  if (ending) return;
  ending = true;
  manager.close();
  if (desktop && desktop.exitCode === null) desktop.kill();
  await bridge.stop();
  const info = await readManifest(dir);
  if (info?.pid === process.pid && info.token === bridge.agentToken) await rm(resolve(dir, 'broker.json'), { force: true });
}
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { void shutdown().finally(() => process.exit(0)); });
process.on('uncaughtException', error => { console.error(error); void shutdown().finally(() => process.exit(1)); });
console.error(`[handoffglass] local broker PID ${process.pid} ready`);
