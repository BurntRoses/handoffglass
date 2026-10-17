#!/usr/bin/env node
/** Native smoke demo: opens an overlay + consent panel without any MCP host. */
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import electron from 'electron';
import { HandoffManager } from '../src/core.mjs';
import { LocalBridge } from '../src/bridge.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manager = new HandoffManager();
const bridge = new LocalBridge(manager);
let child = null;
const nap = ms => new Promise(r => setTimeout(r, ms));
async function close() {
  manager.close();
  if (child && child.exitCode === null) child.kill();
  await bridge.stop();
}
try {
  await bridge.start();
  child = spawn(electron, [resolve(root, 'src/desktop/main.mjs')], {
    stdio: ['ignore', 'ignore', 'inherit'],
    env: { ...process.env, HANDOFFGLASS_PORT: String(bridge.port), HANDOFFGLASS_SECRET: bridge.token }
  });
  child.on('error', err => console.error('Electron launch failed:', err.message));
  for (let i = 0; i < 70 && !bridge.connected; i++) {
    if (child.exitCode !== null || child.signalCode !== null) break;
    await nap(100);
  }
  if (!bridge.connected || !bridge.displays.length) throw new Error('No Electron display attached; run from an interactive desktop session');
  const d = bridge.displays[0];
  const annotation = { x: d.x + d.width * .52, y: d.y + d.height * .45, shape: 'ring', width: 120, height: 70, label: 'Desktop overlay test' };
  const s = manager.show({ title: 'HandoffGlass 桌面测试', message: '这是一条本地测试指引。检查箭头/高亮、鼠标穿透和按钮，然后选择“我已完成”或“拒绝”。', mode: 'handoff', annotations: [annotation], timeoutSeconds: 60 });
  console.log(`Overlay displayed on ${d.id}; waiting for human outcome (session ${s.id})...`);
  const outcome = await manager.wait(s.id, 30000);
  const finalResult = outcome.pending ? await manager.wait(s.id, 30000) : outcome;
  console.log(JSON.stringify(finalResult, null, 2));
  if (finalResult.session?.status === 'awaiting_user') console.log('No decision yet; desktop demo will stop.');
} catch (error) {
  console.error('Desktop test not completed:', error.message);
  process.exitCode = 1;
} finally {
  await close();
}
