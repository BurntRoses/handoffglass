#!/usr/bin/env node
/** Real MCP SDK client/server smoke test. Requires npm install. No GUI required. */
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const client = new Client({ name: 'handoffglass-smoke', version: '0.2.0' });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [resolve(root, 'src/mcp.mjs')],
  env: { ...process.env, HANDOFFGLASS_HEADLESS: '1' },
  stderr: 'pipe'
});
function parse(result) {
  if (result.isError) throw new Error(JSON.stringify(result.content));
  return JSON.parse(result.content.find(x => x.type === 'text').text);
}
try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  const expected = ['screen_displays', 'visual_show', 'handoff_request', 'handoff_status', 'handoff_wait', 'handoff_cancel'];
  assert.deepEqual(tools.map(tool => tool.name).sort(), expected.sort());
  const created = parse(await client.callTool({ name: 'handoff_request', arguments: {
    title: 'Review requested permissions', message: 'Manual step, no guessed target coordinates', timeoutSeconds: 30
  } }));
  assert.equal(created.visible, false);
  assert.equal(created.session.annotations.length, 0);
  const id = created.session.id;
  assert.equal(parse(await client.callTool({ name: 'handoff_status', arguments: { sessionId: id } })).session.status, 'awaiting_user');
  assert.equal(parse(await client.callTool({ name: 'handoff_cancel', arguments: { sessionId: id } })).session.status, 'cancelled');
  assert.equal(parse(await client.callTool({ name: 'handoff_wait', arguments: { sessionId: id } })).session.status, 'cancelled');
  console.log('PASS: MCP v2 initialization, tools/list, handoff_request, status, cancel, wait');
} finally {
  await client.close();
}
