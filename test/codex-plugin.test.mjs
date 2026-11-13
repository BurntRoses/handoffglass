import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {buildCodexPlugin} from '../src/codex-plugin.mjs';
import {handleCodexHook,codexHookDirectory} from '../src/hosts/codex-hooks.mjs';
import {HandoffManager} from '../src/core.mjs';
import {LocalBridge} from '../src/bridge.mjs';
import {writeManifest} from '../src/runtime.mjs';
import {savePreferences} from '../src/local/preferences.mjs';
import {codexPluginPlan} from '../src/codex-plugin-lifecycle.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const owner='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const basic={title:'Plugin fixture',message:'Operate in the original app',continuous:true};
async function isolated(run){
  const dir=await mkdtemp(join(tmpdir(),'hg-plugin-')),env={...process.env,HANDOFFGLASS_RUNTIME_DIR:dir,CODEX_HOME:join(dir,'profile')};
  try{return await run({dir,env});}finally{await rm(dir,{recursive:true,force:true});}
}
async function fixture(run){return isolated(async({dir,env})=>{
  const saved=process.env.HANDOFFGLASS_RUNTIME_DIR;process.env.HANDOFFGLASS_RUNTIME_DIR=dir;
  const manager=new HandoffManager(),bridge=new LocalBridge(manager);bridge.headless=true;
  await bridge.start();await writeManifest(dir,{pid:process.pid,port:bridge.port,token:bridge.agentToken});
  const send=async(body,headers={})=>fetch(`http://127.0.0.1:${bridge.port}/agent/plugin-hook`,{method:'POST',headers:{authorization:`Bearer ${bridge.agentToken}`,'content-type':'application/json','x-handoffglass-owner':other,...headers},body:JSON.stringify(body)});
  try{return await run({dir,env,manager,bridge,send});}finally{await bridge.stop();manager.close();if(saved===undefined)delete process.env.HANDOFFGLASS_RUNTIME_DIR;else process.env.HANDOFFGLASS_RUNTIME_DIR=saved;}
});}
const envelope=(event,extra={})=>({hook_event_name:event,session_id:'host-A',...extra});
const tool=(name,result)=>envelope('PostToolUse',{tool_name:'mcp__handoffglass__'+name,tool_response:{content:[{type:'text',text:JSON.stringify(result)}]}});

test('local plugin declares the tested Codex format, one MCP, hooks and bundled skills without trust edits',()=>isolated(async({dir})=>{
  const connectionEnv={HANDOFFGLASS_RUNTIME_DIR:join(dir,'connection'),CODEX_HOME:join(dir,'profile')};
  const output=join(dir,'bundle'),built=await buildCodexPlugin({output,lifecycle:'enhanced',envOverrides:connectionEnv}),read=path=>readFile(join(built.pluginPath,path),'utf8').then(JSON.parse);
  assert.equal(built.checkoutRequired,false);
  await assert.rejects(read('plugin.json'),{code:'ENOENT'});
  assert.equal((await read('.codex-plugin/plugin.json')).name,'handoffglass');
  assert.equal((await read('.codex-plugin/plugin.json')).hooks,'./hooks/hooks.json');
  assert.deepEqual(Object.keys((await read('.mcp.json')).mcpServers),['handoffglass']);
  const hooks=(await read('hooks/hooks.json')).hooks;
  assert.deepEqual(Object.keys(hooks),['PreToolUse','PostToolUse','Stop','Interrupt','SessionEnd']);
  assert.ok(!hooks.PermissionRequest);
  assert.match(await readFile(join(built.pluginPath,'skills/visual-handoff/references/tool-contracts.md'),'utf8'),/session_wait/);
  assert.match(await readFile(join(built.pluginPath,'hooks/run.mjs'),'utf8'),/codex-hooks\.mjs/);
  const fallback=join(dir,'wrong-runtime');
  const hook=spawnSync(process.execPath,[join(built.pluginPath,'hooks/run.mjs')],{encoding:'utf8',input:JSON.stringify(tool('session_start',{session:{id:owner,status:'waiting_user',step:1,execution:'attached'},resumeToken:'a'.repeat(64)})),env:{...process.env,HANDOFFGLASS_RUNTIME_DIR:fallback},timeout:5000});
  assert.equal(hook.status,0,hook.stderr);assert.equal((await readdir(codexHookDirectory(connectionEnv))).length,1);
  await assert.rejects(readdir(fallback),{code:'ENOENT'});
  await writeFile(join(built.pluginPath,'.codex-plugin/plugin.json'),'user edit');
  await assert.rejects(buildCodexPlugin({output}),/local edits/);
  assert.equal(await readFile(join(built.pluginPath,'.codex-plugin/plugin.json'),'utf8'),'user edit');
}));

test('prewarm and unrelated hooks do not launch a Broker or write files',()=>isolated(async({dir,env})=>{
  let calls=0;const request=async()=>{calls++;return null;};
  const output=await handleCodexHook(envelope('SessionStart'),{env,request});
  assert.match(output.hookSpecificOutput.additionalContext,/visual-handoff/);
  for(const event of ['PreToolUse','PostToolUse','PreModelRequest','Stop'])assert.deepEqual(await handleCodexHook(envelope(event,{tool_name:'shell'}),{env,request}),{});
  assert.equal(calls,0);assert.deepEqual(await readdir(dir),[]);
}));

test('real hooks bind tool results, report phases without journal noise, and cannot take MCP ownership',()=>fixture(async({manager,bridge,env,dir})=>{
  const session=manager.show(basic,owner),resumeToken=manager.issueResume(session.id,owner);
  const result={session,resumeToken};
  await handleCodexHook(tool('session_start',result),{env});
  assert.equal(manager.getOwned(session.id,owner).id,session.id);
  assert.equal(manager.getOwned(session.id,other),null);
  const before=bridge.journal.latestCursor(session.id);
  await handleCodexHook(envelope('PreModelRequest'),{env});
  assert.equal(manager.get(session.id).agentState.phase,'thinking');
  await handleCodexHook(envelope('PreToolUse',{tool_name:'mcp__handoffglass__session_verify'}),{env});
  assert.equal(manager.get(session.id).agentState.phase,'verifying');
  assert.equal(bridge.journal.latestCursor(session.id),before,'progress must not awaken a waiting model');
  const saved=await readFile(join(codexHookDirectory(env),sha('host-A')+'.json'),'utf8');
  assert.ok(!saved.includes(basic.message));assert.ok(!saved.includes('host-A'));
  assert.equal((await readdir(dir)).includes('desktop.json'),false);
  const stop=await handleCodexHook(envelope('Stop'),{env});assert.equal(stop.decision,'block');
  assert.deepEqual(await handleCodexHook(envelope('Stop'),{env}),{});
  assert.deepEqual(await handleCodexHook(envelope('Stop',{stop_hook_active:true}),{env}),{});
  assert.deepEqual(await handleCodexHook(envelope('Stop',{session_id:'host-B'}),{env}),{});
  await savePreferences({enabled:false},dir);
  assert.deepEqual(await handleCodexHook(envelope('Stop'),{env}),{});
  await handleCodexHook(envelope('PreModelRequest'),{env});
  assert.equal(manager.get(session.id).agentState.phase,'verifying');
  await handleCodexHook(envelope('Interrupt'),{env});assert.equal(manager.get(session.id).status,'paused');
  assert.deepEqual(await handleCodexHook(envelope('Stop'),{env}),{});
  await handleCodexHook(envelope('SessionEnd'),{env});assert.equal(manager.get(session.id).status,'cancelled');
  assert.deepEqual(await readdir(codexHookDirectory(env)),[]);
}));

test('binding endpoint rejects wrong credentials, cross-chat access, stale steps and rotates on explicit resume',()=>fixture(async({manager,bridge,send})=>{
  const s=manager.show(basic,owner),resumeToken=manager.issueResume(s.id,owner);
  const body={sessionId:s.id,resumeToken,hostSession:sha('A'),event:'bind',expectedStep:1};
  assert.equal((await send(body,{authorization:`Bearer ${bridge.token}`})).status,401);
  assert.equal((await send({...body,resumeToken:'a'.repeat(64)})).status,404);
  assert.equal((await send({...body,event:'progress',phase:'thinking'})).status,409);
  assert.equal((await send(body)).status,200);
  assert.equal((await send({...body,hostSession:sha('B')})).status,409);
  assert.equal((await send({...body,event:'end',expectedStep:2})).status,409);
  assert.equal(manager.get(s.id).status,'awaiting_user');
  manager.resolve(s.id,'completed');manager.verify(s.id,owner,true);manager.present(s.id,basic,owner);
  assert.equal((await send({...body,event:'interrupt'})).status,409);
  const resumed=manager.resume(s.id,resumeToken,other);
  assert.ok(resumed.resumeToken);
  assert.equal((await send({...body,event:'end'})).status,404);
  assert.equal((await send({...body,hostSession:sha('B'),resumeToken:resumed.resumeToken})).status,200);
  assert.equal(manager.getOwned(s.id,owner),null);assert.equal(manager.getOwned(s.id,other).id,s.id);
}));

test('structured MCP responses establish bindings and failed/unrelated responses cannot replace them',()=>isolated(async({env})=>{
  const session={id:'12345678-1234-4234-8234-123456789012',status:'awaiting_user',step:1},resumeToken='b'.repeat(64),calls=[];
  const request=async(e,s,event)=>{calls.push({s,event});return null;};
  await handleCodexHook(envelope('PostToolUse',{tool_name:'mcp__plugin_handoffglass__session_start',tool_response:{structuredContent:{session,resumeToken}}}),{env,request});
  assert.equal(calls.length,1);assert.equal(calls[0].event,'bind');
  await handleCodexHook(tool('session_wait',{session:{...session,id:'87654321-1234-4234-8234-123456789012'}}),{env,request});
  assert.equal(calls.length,1);
  await handleCodexHook(tool('session_stop',{session:{...session,status:'cancelled'}}),{env,request});
  assert.deepEqual(await readdir(codexHookDirectory(env)),[]);
}));

test('plugin cleanup preview preserves unknown and edited files and excludes private proofs from public items',()=>isolated(async({dir,env})=>{
  const build=await buildCodexPlugin({output:join(dir,'bundle')});
  const {mkdir}=await import('node:fs/promises');await mkdir(env.CODEX_HOME);
  await writeFile(join(env.CODEX_HOME,'handoffglass-plugin-install.json'),JSON.stringify({version:1,plugin:build.plugin,marketplaceRoot:build.marketplaceRoot,command:'codex'}));
  await writeFile(join(build.pluginPath,'notes.txt'),'keep');await writeFile(join(build.pluginPath,'.codex-plugin/plugin.json'),'edit');
  const plan=await codexPluginPlan({dir,codexHome:env.CODEX_HOME});
  assert.equal(plan.retained.length,2);assert.equal(plan.changed,true);
  assert.equal(plan.items.some(x=>x.path.endsWith('notes.txt')),false);
  assert.equal(plan.items.some(x=>x.path===join(build.pluginPath,'.codex-plugin/plugin.json')),false);
  const receiptPath=join(build.marketplaceRoot,'handoffglass-build.json'),receipt=JSON.parse(await readFile(receiptPath,'utf8'));
  receipt.files['plugins/handoffglass/../../private']=sha('keep');await writeFile(receiptPath,JSON.stringify(receipt));
  await assert.rejects(codexPluginPlan({dir,codexHome:env.CODEX_HOME}),/Invalid plugin file ownership/);
}));


test('light plugin has no executable hooks; optional lifecycle choice survives rebuild and can be removed transactionally',()=>isolated(async({dir})=>{
  const output=join(dir,'bundle'),build=await buildCodexPlugin({output});
  const read=path=>readFile(join(build.pluginPath,path),'utf8').then(JSON.parse);
  assert.equal(build.lifecycle,'light');assert.equal((await read('.codex-plugin/plugin.json')).hooks,undefined);
  await assert.rejects(read('hooks/hooks.json'),{code:'ENOENT'});
  assert.equal((await read('.mcp.json')).mcpServers.handoffglass.env.HANDOFFGLASS_TOOL_PROFILE,'host');
  await buildCodexPlugin({output,lifecycle:'enhanced'});
  const hooks=(await read('hooks/hooks.json')).hooks;
  assert.equal(hooks.PreModelRequest,undefined);assert.equal(hooks.SessionStart,undefined);
  const matcher=new RegExp(hooks.PreToolUse[0].matcher);
  assert.equal(matcher.test('mcp__handoffglass__screen_mark'),false);
  assert.equal(matcher.test('mcp__handoffglass__session_verify'),true);
  assert.equal((await buildCodexPlugin({output})).lifecycle,'enhanced');
  await buildCodexPlugin({output,lifecycle:'light'});
  await assert.rejects(read('hooks/run.mjs'),{code:'ENOENT'});
  assert.equal((await buildCodexPlugin({output})).lifecycle,'light');
  await buildCodexPlugin({output,toolProfile:'full'});
  assert.equal((await buildCodexPlugin({output})).toolProfile,'full');
}));
