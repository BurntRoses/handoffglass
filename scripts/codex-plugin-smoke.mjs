#!/usr/bin/env node
/** Optional native-host test. Uses a disposable profile, no model or hook trust. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {mkdtemp,mkdir,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {installCodexPlugin} from '../src/codex-plugin-lifecycle.mjs';
import {cleanupIntegration} from '../src/integration-lifecycle.mjs';
import {readManifest} from '../src/runtime.mjs';
const base=await mkdtemp(join(tmpdir(),'hg-codex-native-'));
const options={codexHome:join(base,'codex'),dir:join(base,'runtime'),output:join(base,'marketplace'),desktopRuntime:false};
options.mcpEnv={HANDOFFGLASS_RUNTIME_DIR:options.dir,HANDOFFGLASS_HEADLESS:'1'};
await mkdir(options.codexHome);await mkdir(options.dir,{mode:0o700});
await writeFile(join(options.codexHome,'config.toml'),'# Personal setting retained by native install/remove\nmodel_reasoning_effort="low"\n');
const cli=process.env.HANDOFFGLASS_CODEX_COMMAND||'codex';
process.env.HANDOFFGLASS_HEADLESS='1';
let child;
try{
  const installed=await installCodexPlugin({...options,codexCommand:cli});
  assert.ok(installed.result);
  const updated=await installCodexPlugin({...options,codexCommand:cli,mcpEnv:{...options.mcpEnv,HANDOFFGLASS_PLUGIN_TEST:'updated'}});
  const cached=JSON.parse(await readFile(join(updated.result.installedPath,'.mcp.json'),'utf8'));
  assert.equal(cached.mcpServers.handoffglass.env.HANDOFFGLASS_PLUGIN_TEST,'updated','Reinstall must refresh the same-version local trial');
  child=spawn(cli,['app-server'],{env:{...process.env,CODEX_HOME:options.codexHome,HANDOFFGLASS_RUNTIME_DIR:options.dir},stdio:['pipe','pipe','pipe']});
  let seq=0;const pending=new Map();let stderr='';child.stderr.on('data',c=>{stderr=(stderr+c).slice(-4000);});
  const lines=createInterface({input:child.stdout});
  lines.on('line',line=>{try{const msg=JSON.parse(line),call=pending.get(msg.id);if(call){pending.delete(msg.id);clearTimeout(call.timer);msg.error?call.reject(Error(JSON.stringify(msg.error))):call.resolve(msg.result);}}catch{/* Host diagnostic line. */}});
  const request=(method,params)=>new Promise((resolve,reject)=>{
    const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(Error('Native host timed out: '+method+' '+stderr));},25000);
    pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({id,method,params})+'\n');
  });
  await request('initialize',{clientInfo:{name:'handoffglass_native_smoke',version:'0.20.0'},capabilities:{experimentalApi:true}});
  child.stdin.write(JSON.stringify({method:'initialized'})+'\n');
  const started=await request('thread/start',{cwd:base});
  const threadId=started.thread.id;
  const hooks=await request('hooks/list',{threadId});
  const own=hooks.data.flatMap(d=>d.hooks).filter(h=>h.pluginId?.startsWith('handoffglass@'));
  assert.equal(own.length,0,JSON.stringify(hooks));
  assert.ok(own.every(h=>h.trustStatus==='untrusted'),'The test must never implicitly trust hooks');
  assert.deepEqual(hooks.data.flatMap(d=>d.errors),[]);
  const skills=await request('skills/list',{cwds:[base]});
  const skillNames=skills.data.flatMap(d=>d.skills).map(s=>s.name);
  assert.ok(skillNames.includes('handoffglass:visual-handoff'));assert.ok(skillNames.includes('handoffglass:handoffglass-setup'));
  const status=await request('mcpServerStatus/list',{threadId});
  const server=status.data.find(s=>s.name.includes('handoffglass'));
  assert.ok(server,JSON.stringify(status));
  assert.equal(Object.keys(server.tools).length,19,JSON.stringify({server,stderr}));
  const response=await request('mcpServer/tool/call',{threadId,server:server.name,tool:'screen_displays',arguments:{}});
  assert.notEqual(response.isError,true,JSON.stringify(response));
  const value=response.structuredContent||JSON.parse(response.content.find(c=>c.type==='text').text);
  assert.equal(value.headless,true);
  const preview=await cleanupIntegration('codex',{...options,confirm:false});
  assert.ok(preview.items.some(i=>i.kind==='native_plugin'));
  // Full removal is exposed through the same service used by App and MCP.
  const removed=await cleanupIntegration('codex',{...options,confirm:true});
  assert.equal(removed.complete,true,JSON.stringify(removed));
  await assert.rejects(readFile(join(options.codexHome,'handoffglass-plugin-install.json')),{code:'ENOENT'});
  await assert.rejects(readFile(join(options.output,'handoffglass-build.json')),{code:'ENOENT'});
  const again=await cleanupIntegration('codex',{...options,confirm:true});assert.equal(again.applied,false);
  assert.match(await readFile(join(options.codexHome,'config.toml'),'utf8'),/model_reasoning_effort\s*=\s*"low"/);
  console.log(JSON.stringify({nativePlugin:'loaded',hooks:own.map(h=>({event:h.eventName,trust:h.trustStatus})),skills:skillNames.filter(n=>n.includes('handoff')),server:server.name,toolCount:19,firstCall:'screen_displays',headless:true,cleanup:'passed',modelCalls:0},null,2));
}finally{
  if(child){child.stdin.end();child.kill();}
  const live=await readManifest(options.dir);
  if(live){try{process.kill(live.pid,'SIGTERM');}catch{/* Broker already stopped. */}}
  if(process.env.HANDOFFGLASS_KEEP_TEST==='1')console.error('Test fixture retained: '+base);else await rm(base,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
