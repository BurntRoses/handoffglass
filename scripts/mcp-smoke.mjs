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
import { readManifest, readDesktopManifest } from '../src/runtime.mjs';
import { fromJSONSchema } from 'zod/v4';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = await mkdtemp(join(tmpdir(), 'handoffglass-mcp-'));
const extras = process.argv.includes('--extras');
const legacy=process.argv.includes('--legacy');
const hostProfile=process.argv.includes('--host');
const env = { ...process.env, HANDOFFGLASS_HEADLESS: '1', HANDOFFGLASS_RUNTIME_DIR: dir, HANDOFFGLASS_EXTRAS: extras ? '1' : '0',HANDOFFGLASS_LEGACY_TOOLS:legacy?'1':'0',HANDOFFGLASS_TOOL_PROFILE:hostProfile?'host':'full' };
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
  assert.ok((a.getInstructions() || '').length <= 512);
  assert.match(a.getInstructions() || '', /host observes/);
  assert.match(a.getInstructions() || '', /never ask the user to name a tool/);
  const { tools } = await a.listTools();
  const names=['screen_mark','screen_displays',...(!hostProfile?['ui_inspect','ui_locate']:[]),'capability_manifest','session_start','session_present','session_wait','session_update','session_verify','session_stop','session_resume','session_control','integration_uninstall','connection_status','permission_status','integration_status','integration_cleanup','integration_set_enabled'];
  if(legacy)names.push('visual_show','handoff_request','visual_scene_update','handoff_status','handoff_events','handoff_wait','handoff_cancel');
  if (extras) names.push('handoff_context', 'handoff_blueprint', 'handoff_assess');
  assert.deepEqual(tools.map(tool => tool.name).sort(), names.sort());
  const {manifest,runtime}=await invoke(a,'capability_manifest',{});
  assert.equal(runtime.native.status,'not_probed');
  assert.deepEqual(manifest.visuals.categories.flatMap(c=>c.shapes).sort(),[...SHAPES].sort());
  assert.deepEqual(manifest.visuals.effects,EFFECTS);
  for(const example of manifest.quickstart){
    const tool=tools.find(t=>t.name===example.tool);
    assert.ok(tool,`Unknown quickstart tool: ${example.tool}`);
    assert.equal(fromJSONSchema(tool.inputSchema).safeParse(example.args).success,true,`Invalid quickstart arguments: ${example.tool}`);
  }
  if (extras) {
    const context = await invoke(a, 'handoff_context', {});
    assert.equal(context.storage, 'local');
    assert.equal(context.historyStored, false);
    const blueprint = await invoke(a, 'handoff_blueprint', {blueprint:'authorization',locale:'zh-CN'});
    assert.equal(blueprint.estimatedTokenCost, 0);
    assert.equal(blueprint.steps.length, 3);
    assert.equal(blueprint.verification, 'independent_check_required');
    const assessment = await invoke(a,'handoff_assess',{blueprint:'authorization', evidence:'ambiguous'});
    assert.equal(assessment.nextTool,'session_start');
    assert.equal(assessment.coordinateFree,true);
    assert.equal(assessment.neverAutoApprove,true);
  }
  const lifecycle = await invoke(a, 'integration_status', { host: 'workbuddy' });
  assert.ok(['not_installed', 'bundle_ready'].includes(lifecycle.status.state));
  const cleanupPlan = await invoke(a, 'integration_cleanup', { host: 'workbuddy', confirm: false });
  assert.equal(cleanupPlan.result.confirmationRequired, true);
  const { prompts } = await a.listPrompts();
  assert.ok(prompts.some(p => p.name === 'assist-with-ui-step'));
  const guide = await a.getPrompt({ name: 'assist-with-ui-step', arguments: { task: 'Review account access' } });
  assert.match(guide.messages[0].content.text, /Do not invent screen coordinates/);
  const params = { title: 'Permission review', message: 'Human decision needed; no guessed coordinates', timeoutSeconds: 30, requestId: 'smoke-case-unique-123' };
  assert.equal((await invoke(a, 'screen_displays', {})).headless, true);
  const desktop=await readDesktopManifest(dir);
  const hello=await fetch(`http://127.0.0.1:${desktop.port}/hello`,{method:'POST',headers:{authorization:`Bearer ${desktop.desktopToken}`,'content-type':'application/json'},body:JSON.stringify({displays:[{id:'fixture',x:0,y:0,width:1440,height:900,primary:true}]})});
  assert.equal(hello.status,200);
  const drawing=await invoke(a,'screen_mark',{sequence:true,lineStyle:'dashed',marks:[{shape:'spotlight',placement:'left',label:'区域'},{shape:'arrow',placement:'right',direction:'left'}]});
  assert.equal(drawing.revision,1);assert.equal(drawing.count,4);assert.equal(drawing.nextAction,'done');
  const otherDrawing=await b.callTool({name:'screen_mark',arguments:{action:'clear',id:drawing.id,expectedRevision:1}});
  assert.equal(otherDrawing.isError,true);
  const revised=await invoke(a,'screen_mark',{action:'update',id:drawing.id,expectedRevision:1,color:'#75b9ff'});
  assert.equal(revised.revision,2);assert.equal(revised.expiresAt,drawing.expiresAt);
  assert.equal((await invoke(a,'screen_mark',{action:'clear',id:drawing.id,expectedRevision:2})).visible,false);
  const first = await invoke(a, 'session_start', params);
  assert.equal(first.visible, false);
  const id = first.session.id;
  assert.ok(first.nextCursor>0);
  assert.equal((await invoke(a,'session_wait',{sessionId:id,cursor:first.nextCursor,maxWaitSeconds:0})).events.length,0,'Present response cursor must skip already acknowledged setup events');
  assert.equal((await invoke(a, 'session_start', params)).session.id, id, 'same requestId must not open duplicate prompt');
  const denied = await b.callTool({ name: 'session_start', arguments: params });
  assert.equal(denied.isError, true);
  assert.equal(JSON.parse(denied.content[0].text).code, 'busy');
  assert.equal((await b.callTool({name:'session_wait',arguments:{sessionId:id,maxWaitSeconds:0}})).isError,true);
  assert.equal((await invoke(b, 'session_stop', { sessionId: id })).error, 'not_found');
  assert.equal((await invoke(a, 'session_wait', { sessionId: id,maxWaitSeconds:0 })).session.status, 'awaiting_user');
  const stream = await invoke(a,'session_wait',{sessionId:id,cursor:0,maxWaitSeconds:0});
  assert.equal(stream.events[0].type,'session_started');
  assert.equal(stream.nextAction,'yield_to_user');
  assert.equal(first.session.execution,'parked');
  await invoke(a,'session_control',{sessionId:id,action:'attach'});
  const next = await invoke(a,'session_wait',{sessionId:id,cursor:stream.nextCursor,maxWaitSeconds:0});
  assert.deepEqual(next.events.map(e=>e.type),['session_attached']);
  assert.equal((await invoke(a, 'session_stop', { sessionId: id })).session.status, 'cancelled');
  assert.equal((await invoke(a, 'session_wait', { sessionId: id })).session.status, 'cancelled');
  const second = await invoke(b, 'session_start', params);
  assert.notEqual(id, second.session.id);
  assert.equal((await invoke(b, 'session_stop', { sessionId: second.session.id })).session.status, 'cancelled');
  if(hostProfile){
    const h=await invoke(a,'session_start',{mode:'guide',title:'Host region',message:'Review the highlighted region',bounds:{x:20,y:40,width:200,height:80},frame:{width:1440,height:900,bounds:{x:0,y:0,width:1440,height:900}}});
    assert.equal(h.session.annotations[0].x,120);
    const update=await invoke(a,'session_update',{sessionId:h.session.id,expectedRevision:1,bounds:{x:200,y:100,width:40,height:20}});
    assert.equal(update.session.annotations[0].x,220);
    assert.equal(update.session.annotations[0].shape,'spotlight');
    await invoke(a,'session_verify',{sessionId:h.session.id,verified:true,finish:true,expectedStep:1});
    assert.equal(tools.some(t=>t.name==='ui_inspect'),false);
    assert.equal(tools.find(t=>t.name==='session_start').inputSchema.properties.target,undefined);
  }else{
  const painted = await invoke(a, 'session_start', {mode:'guide', title:'Visual scene', message:'Review the highlight',
    scene:{version:1,layers:[{id:'focus',annotations:SHAPES.map((shape,i)=>({id:`mark_${i}`,x:10+i*20,y:20,shape,tone:'info',effect:EFFECTS[i%EFFECTS.length],delayMs:i*120,durationMs:1100,exit:'retract',maskStyle:'deep'}))}]}});
  assert.equal(painted.session.sceneRevision,1);
  assert.deepEqual(painted.session.annotations.map(a=>a.shape),SHAPES);
  assert.equal(painted.session.annotations[3].effect,'still');
  assert.equal(painted.session.annotations[3].maskStyle,'deep');assert.equal(painted.session.annotations[3].exit,'retract');
  assert.equal(painted.session.annotations[3].delayMs,360);
  assert.equal(painted.session.annotations[3].durationMs,1100);
  const invalidEffect=await a.callTool({name:'session_start',arguments:{title:'Invalid',message:'Invalid effect must fail',annotations:[{x:10,y:20,effect:'spin'}]}});
  assert.equal(invalidEffect.isError,true);
  assert.equal((await invoke(a,'session_wait',{sessionId:painted.session.id,maxWaitSeconds:0})).session.sceneRevision,1);
  const mutating = {sessionId:painted.session.id,expectedRevision:1,
    operations:[{op:'set_layer',layerId:'focus',visible:false}]};
  const otherHost = await b.callTool({name:'session_update',arguments:mutating});
  assert.equal(otherHost.isError,true);
  assert.equal((await invoke(a,'session_update',mutating)).session.sceneRevision,2);
  assert.equal((await invoke(a,'session_wait',{sessionId:painted.session.id,maxWaitSeconds:0})).session.annotations.length,0);
  assert.equal((await invoke(a,'session_verify',{sessionId:painted.session.id,verified:true,finish:true,expectedStep:1})).session.status,'completed');
  }
  const continuous=await invoke(a,'session_start',{execution:'attached',title:'Step one',message:'Review the current screen',requestId:'continuous-smoke-1'});
  assert.equal(continuous.session.continuous,true);
  const initial=await invoke(a,'session_wait',{sessionId:continuous.session.id,cursor:0,maxWaitSeconds:0});
  assert.ok(initial.events.length);
  assert.equal((await a.callTool({name:'session_present',arguments:{sessionId:continuous.session.id,title:'Too early',message:'Must verify first'}})).isError,true);
  await invoke(a,'session_control',{sessionId:continuous.session.id,action:'pause',expectedStep:1});
  assert.equal((await invoke(a,'session_wait',{sessionId:continuous.session.id,maxWaitSeconds:0})).session.status,'paused');
  await invoke(a,'session_control',{sessionId:continuous.session.id,action:'resume',expectedStep:1});
  const recovered=await invoke(b,'session_resume',{sessionId:continuous.session.id,resumeToken:continuous.resumeToken});
  assert.equal(recovered.session.nextAction,'observe_app');
  assert.notEqual(recovered.resumeToken,continuous.resumeToken);
  assert.equal((await a.callTool({name:'session_wait',arguments:{sessionId:continuous.session.id,maxWaitSeconds:0}})).isError,true);
  const back=await invoke(a,'session_resume',{sessionId:continuous.session.id,resumeToken:recovered.resumeToken});
  const represent=await invoke(a,'session_present',{sessionId:continuous.session.id,title:'Step one recovered',message:'Inspect then resume',mode:'handoff',completion:{kind:'observed_condition'},requestId:'continuous-recover-1'});
  assert.equal(represent.session.step,1);
  await invoke(a,'session_verify',{sessionId:continuous.session.id,verified:true,expectedStep:1});
  const stepTwo=await invoke(a,'session_present',{sessionId:continuous.session.id,title:'Step two',message:'Continue in the same window',requestId:'continuous-smoke-2'});
  assert.equal(stepTwo.session.id,continuous.session.id);assert.equal(stepTwo.session.step,2);
  const paused=await invoke(a,'integration_set_enabled',{enabled:false});assert.equal(paused.code,'disabled_by_user');
  assert.equal((await a.callTool({name:'session_wait',arguments:{sessionId:continuous.session.id,maxWaitSeconds:0}})).isError,true);
  assert.equal((await a.callTool({name:'session_start',arguments:{title:'No',message:'Disabled'}})).isError,true);
  await invoke(a,'integration_set_enabled',{enabled:true});
  console.log(`PASS: MCP v2 stdio, ${tools.length} tools, initialize instructions, dual hosts, continuous sessions, lifecycle, scene updates, ownership, cancellation`);
} finally {
  for (const c of clients) await c.close().catch(() => {});
  const info = await readManifest(dir);
  if (info) { try { process.kill(info.pid, 'SIGTERM'); } catch {} }
  await new Promise(r => setTimeout(r, 150));
  await rm(dir, { recursive: true, force: true, maxRetries: 12, retryDelay: 250 });
}
