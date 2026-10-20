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
import { SHAPES, EFFECTS } from '../src/visual/scene.mjs';
import { readManifest } from '../src/runtime.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = await mkdtemp(join(tmpdir(), 'handoffglass-mcp-'));
const extras = process.argv.includes('--extras');
const env = { ...process.env, HANDOFFGLASS_HEADLESS: '1', HANDOFFGLASS_RUNTIME_DIR: dir, HANDOFFGLASS_EXTRAS: extras ? '1' : '0' };
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
  const names = [
    'screen_displays', 'ui_locate', 'visual_show', 'visual_scene_update', 'handoff_request', 'handoff_status', 'handoff_events', 'handoff_wait', 'handoff_cancel'
  ];
  if (extras) names.push('handoff_context', 'handoff_blueprint', 'handoff_assess');
  assert.deepEqual(tools.map(tool => tool.name).sort(), names.sort());
  if (extras) {
    const context = await invoke(a, 'handoff_context', {});
    assert.equal(context.storage, 'local');
    assert.equal(context.historyStored, false);
    const blueprint = await invoke(a, 'handoff_blueprint', {blueprint:'authorization',locale:'zh-CN'});
    assert.equal(blueprint.estimatedTokenCost, 0);
    assert.equal(blueprint.steps.length, 3);
    assert.equal(blueprint.verification, 'independent_check_required');
    const assessment = await invoke(a,'handoff_assess',{blueprint:'authorization', evidence:'ambiguous'});
    assert.equal(assessment.nextTool,'handoff_request');
    assert.equal(assessment.coordinateFree,true);
    assert.equal(assessment.neverAutoApprove,true);
  }
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
  const stream = await invoke(a,'handoff_events',{sessionId:id});
  assert.equal(stream.events[0].type,'started');
  assert.equal(stream.recovery,'await_human_or_continue');
  const next = await invoke(a,'handoff_events',{sessionId:id,after:stream.nextCursor});
  assert.equal(next.events.length,0);
  assert.equal((await invoke(a, 'handoff_cancel', { sessionId: id })).session.status, 'cancelled');
  assert.equal((await invoke(a, 'handoff_wait', { sessionId: id })).session.status, 'cancelled');
  const second = await invoke(b, 'handoff_request', params);
  assert.notEqual(id, second.session.id);
  assert.equal((await invoke(b, 'handoff_cancel', { sessionId: second.session.id })).session.status, 'cancelled');
  const painted = await invoke(a, 'visual_show', { title:'Visual scene', message:'Review the highlight',
    scene:{version:1,layers:[{id:'focus',annotations:SHAPES.map((shape,i)=>({id:`mark_${i}`,x:10+i*20,y:20,shape,tone:'info',effect:EFFECTS[i%EFFECTS.length],delayMs:i*120,durationMs:1100}))}]}});
  assert.equal(painted.session.sceneRevision,1);
  assert.deepEqual(painted.session.annotations.map(a=>a.shape),SHAPES);
  assert.equal(painted.session.annotations[3].effect,'still');
  assert.equal(painted.session.annotations[3].delayMs,360);
  assert.equal(painted.session.annotations[3].durationMs,1100);
  const invalidEffect=await a.callTool({name:'visual_show',arguments:{title:'Invalid',message:'Invalid effect must fail',annotations:[{x:10,y:20,effect:'spin'}]}});
  assert.equal(invalidEffect.isError,true);
  assert.equal((await invoke(a,'handoff_status',{sessionId:painted.session.id})).session.sceneRevision,1);
  const mutating = {sessionId:painted.session.id,expectedRevision:1,
    operations:[{op:'set_layer',layerId:'focus',visible:false}]};
  const otherHost = await b.callTool({name:'visual_scene_update',arguments:mutating});
  assert.equal(otherHost.isError,true);
  assert.equal((await invoke(a,'visual_scene_update',mutating)).session.sceneRevision,2);
  assert.equal((await invoke(a,'handoff_status',{sessionId:painted.session.id})).session.annotations.length,0);
  assert.equal((await invoke(a,'handoff_cancel',{sessionId:painted.session.id})).session.status,'cancelled');
  console.log(`PASS: MCP v2 stdio, ${extras ? 'twelve' : 'nine'} tools, dual hosts, scene updates, local context/blueprints, ownership, cancellation`);
} finally {
  for (const c of clients) await c.close().catch(() => {});
  const info = await readManifest(dir);
  if (info) { try { process.kill(info.pid, 'SIGTERM'); } catch {} }
  await new Promise(r => setTimeout(r, 150));
  await rm(dir, { recursive: true, force: true, maxRetries: 12, retryDelay: 250 });
}
