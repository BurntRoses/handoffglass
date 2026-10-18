#!/usr/bin/env node
/** Full MCP v2 client/server smoke, with TWO distinct hosts and one broker. */
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { readManifest } from '../src/runtime.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = await mkdtemp(join(tmpdir(), 'handoffglass-mcp-'));
const env = { ...process.env, HANDOFFGLASS_HEADLESS: '1', HANDOFFGLASS_RUNTIME_DIR: dir };
const clients = [];
function decode(result) {
  if (result.isError) throw new Error(result.content.map(c => c.text || '').join('; '));
  return JSON.parse(result.content.find(c => c.type === 'text').text);
}
async function client(name) {
  const instance = new Client({ name, version: '0.3.0' });
  const transport = new StdioClientTransport({
    command: process.execPath, args: [resolve(root, 'src/mcp.mjs')], env, stderr: 'pipe'
  });
  clients.push(instance);
  await instance.connect(transport);
  return instance;
}
const invoke = async (c, name, args) => decode(await c.callTool({ name, arguments: args }));
try {
  const [a, b] = await Promise.all([client('host-A'), client('host-B')]);
  const { tools } = await a.listTools();
  assert.deepEqual(tools.map(tool => tool.name).sort(), [
    'screen_displays', 'visual_show', 'handoff_request', 'handoff_status', 'handoff_wait', 'handoff_cancel'
  ].sort());
  const { prompts } = await a.listPrompts();
  assert.ok(prompts.some(p => p.name === 'assist-with-ui-step'));
  const guide = await a.getPrompt({ name: 'assist-with-ui-step', arguments: { task: 'Review account access' } });
  assert.match(guide.messages[0].content.text, /Do not invent screen coordinates/);
  const params = { title: 'Permission review', message: 'Human decision needed; no guessed coordinates', timeoutSeconds: 30, requestId: 'smoke-case-unique-123' };
  assert.equal((await invoke(a, 'screen_displays', {})).headless, true);
  const first = await invoke(a, 'handoff_request', params);
  assert.equal(first.visible, false);
  const id = first.session.id;
  assert.equal((await invoke(a, 'handoff_request', params)).session.id, id, 'same requestId must not open duplicate prompt');
  const denied = await b.callTool({ name: 'handoff_request', arguments: params });
  assert.equal(denied.isError, true);
  assert.equal(JSON.parse(denied.content[0].text).code, 'busy');
  assert.equal((await invoke(b, 'handoff_status', { sessionId: id })).session, null);
  assert.equal((await invoke(b, 'handoff_cancel', { sessionId: id })).error, 'not_found');
  assert.equal((await invoke(a, 'handoff_status', { sessionId: id })).session.status, 'awaiting_user');
  assert.equal((await invoke(a, 'handoff_cancel', { sessionId: id })).session.status, 'cancelled');
  assert.equal((await invoke(a, 'handoff_wait', { sessionId: id })).session.status, 'cancelled');
  const second = await invoke(b, 'handoff_request', params);
  assert.notEqual(id, second.session.id);
  assert.equal((await invoke(b, 'handoff_cancel', { sessionId: second.session.id })).session.status, 'cancelled');
  console.log('PASS: MCP v2 stdio, six tools, dual hosts, deduplicated handoff, ownership, cancellation');
} finally {
  for (const c of clients) await c.close().catch(() => {});
  const info = await readManifest(dir);
  if (info) { try { process.kill(info.pid, 'SIGTERM'); } catch {} }
  await new Promise(r => setTimeout(r, 150));
  await rm(dir, { recursive: true, force: true });
}
