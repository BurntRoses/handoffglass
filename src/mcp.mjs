#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import { HandoffManager } from './core.mjs';
import { LocalBridge } from './bridge.mjs';
import { canLocateAll } from './geometry.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manager = new HandoffManager();
const bridge = new LocalBridge(manager);
await bridge.start();
let desktop = null;
const headless = process.env.HANDOFFGLASS_HEADLESS === '1';
const nap = ms => new Promise(resolve => setTimeout(resolve, ms));

async function ensureDesktop() {
  if (headless) return;
  if (bridge.connected && desktop && desktop.exitCode === null && desktop.signalCode === null) return;
  if (!desktop || desktop.exitCode !== null || desktop.signalCode !== null) {
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
    desktop.on('error', err => process.stderr.write(`[handoffglass desktop] ${err.message}\n`));
  }
  const started = Date.now();
  while (Date.now() - started < 8000) {
    if (bridge.connected && desktop && desktop.exitCode === null && desktop.signalCode === null) return;
    if (desktop?.exitCode !== null || desktop?.signalCode !== null) break;
    await nap(120);
  }
  throw new Error('The desktop overlay did not connect. Check Electron installation and your graphical desktop session.');
}

const annotation = z.object({
  x: z.number().finite().min(-100000).max(100000),
  y: z.number().finite().min(-100000).max(100000),
  shape: z.enum(['arrow', 'ring', 'box', 'spotlight']).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  label: z.string().max(64).optional(),
  width: z.number().positive().max(5000).optional(),
  height: z.number().positive().max(5000).optional()
});
const presentation = z.object({
  title: z.string().trim().min(1).max(100),
  message: z.string().trim().min(1).max(1000),
  x: z.number().finite().min(-100000).max(100000).optional(),
  y: z.number().finite().min(-100000).max(100000).optional(),
  shape: z.enum(['arrow', 'ring', 'box', 'spotlight']).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  annotations: z.array(annotation).max(8).optional(),
  timeoutSeconds: z.number().int().min(10).max(3600).optional()
});
const json = object => ({ content: [{ type: 'text', text: JSON.stringify(object) }] });
const fail = error => ({ isError: true, ...json({ error: error instanceof Error ? error.message : String(error) }) });
async function present(args, mode) {
  try {
    await ensureDesktop();
    if (!headless && !bridge.connected) throw new Error('Desktop client unavailable');
    const annotations = args.annotations ?? (args.x !== undefined && args.y !== undefined ? [{ x: args.x, y: args.y }] : []);
    if (!headless && annotations.length && !canLocateAll(bridge.displays, annotations)) {
      throw new Error('A target is outside connected display bounds. Call screen_displays for global DIP bounds.');
    }
    const session = manager.show({ ...args, mode });
    return json({ session, visible: !headless, coordinateSystem: 'global_DIP',
      instruction: 'Wait for user decision; completed is user-reported only. Verify the downstream UI before claiming task success.' });
  } catch (error) { return fail(error); }
}
function makeServer() {
  const server = new McpServer({ name: 'handoffglass', version: '0.2.0' });
  server.registerTool('screen_displays', {
    title: 'Inspect display geometry',
    description: 'Return connected screen bounds in device-independent pixels (DIP). Does not capture pixels or find UI controls.',
    inputSchema: z.object({}), annotations: { readOnlyHint: true }
  }, async () => { try { await ensureDesktop(); return json({ displays: bridge.displays, connected: bridge.connected, headless }); } catch (e) { return fail(e); } });
  server.registerTool('visual_show', {
    title: 'Show visual guidance',
    description: 'Highlight up to eight already-located targets using a local click-through overlay. Requires grounded x/y DIP coordinates (or annotations); never guess positions. No automated clicks.',
    inputSchema: presentation, annotations: { readOnlyHint: false }
  }, async args => present(args, 'guide'));
  server.registerTool('handoff_request', {
    title: 'Request a human handoff',
    description: 'Display a human-decision panel and optional grounded visual annotations. No coordinates are required when the target cannot be located. Pauses your own workflow logically; returns a session ID; does not click or grant permissions.',
    inputSchema: presentation, annotations: { readOnlyHint: false }
  }, async args => present(args, 'handoff'));
  server.registerTool('handoff_status', {
    title: 'Read handoff state',
    description: 'Check outcome. completed means only that the user indicated completion, not that the target action was verified.',
    inputSchema: z.object({ sessionId: z.string().uuid() }), annotations: { readOnlyHint: true }
  }, async ({ sessionId }) => json({ session: manager.get(sessionId), connected: bridge.connected }));
  server.registerTool('handoff_wait', {
    title: 'Wait for the human response',
    description: 'Wait up to 30s for a decision. pending, expired, declined, cancelled and superseded are not successful completion.',
    inputSchema: z.object({ sessionId: z.string().uuid(), maxWaitSeconds: z.number().min(0).max(30).default(15) }),
    annotations: { readOnlyHint: true }
  }, async ({ sessionId, maxWaitSeconds }) => json(await manager.wait(sessionId, maxWaitSeconds * 1000)));
  server.registerTool('handoff_cancel', {
    title: 'Cancel handoff or clear guidance',
    description: 'Dismiss only this session; never dismiss an unrelated/newer handoff.',
    inputSchema: z.object({ sessionId: z.string().uuid() }), annotations: { readOnlyHint: false }
  }, async ({ sessionId }) => json(manager.resolve(sessionId, 'cancelled')));
  return server;
}
async function cleanup() {
  manager.close();
  if (desktop && desktop.exitCode === null) desktop.kill();
  await bridge.stop();
}
process.stdin.once('end', () => { void cleanup().finally(() => process.exit(0)); });
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => { void cleanup().finally(() => process.exit(0)); });
}
process.once('exit', () => { if (desktop && desktop.exitCode === null) desktop.kill(); });
void serveStdio(makeServer).catch(err => { console.error('[handoffglass] MCP transport failed:', err); void cleanup().finally(() => { process.exitCode = 1; }); });
console.error(`[handoffglass] MCP ready (loopback bridge :${bridge.port}; no external listener)`);
