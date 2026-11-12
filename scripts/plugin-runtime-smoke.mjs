#!/usr/bin/env node
/** Move a complete plugin and run its copied MCP + renderer, without the source entry or installed App. */
import assert from 'node:assert/strict';
import {mkdtemp,rename,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {buildCodexPlugin} from '../src/codex-plugin.mjs';
import {readManifest} from '../src/runtime.mjs';
import {savePreferences} from '../src/local/preferences.mjs';
const base=await mkdtemp(join(tmpdir(),'hg-portable-runtime-')),dir=join(base,'state'),client=new Client({name:'relocated-plugin',version:'1'});
try{
  await savePreferences({theme:'light'},dir);
  const build=await buildCodexPlugin({output:join(base,'market'),desktopRuntime:true});
  const moved=join(base,'relocated');await rename(build.pluginPath,moved);
  const config=JSON.parse(await readFile(join(moved,'.mcp.json'),'utf8')).mcpServers.handoffglass;
  assert.equal(config.args[0],'${PLUGIN_ROOT}/runtime/src/mcp.mjs');
  const transport=new StdioClientTransport({command:config.command,args:config.args.map(v=>v.replaceAll('${PLUGIN_ROOT}',moved)),env:{...process.env,...config.env,HANDOFFGLASS_RUNTIME_DIR:dir},stderr:'pipe'});
  let errors='';transport.stderr?.on('data',c=>{errors=(errors+c).slice(-3000);});
  await client.connect(transport);
  const call=async(name,args={})=>{const r=await client.callTool({name,arguments:args});assert.notEqual(r.isError,true,JSON.stringify(r)+' '+errors);return r.structuredContent||JSON.parse(r.content[0].text);};
  const screens=await call('screen_displays');assert.ok(screens.displays.length);assert.equal(screens.connected,true);
  const result=await call('screen_mark',{shape:'ring',placement:'top_left',label:'运行时检查',durationSeconds:10});
  assert.equal(result.nextAction,'done');
  await call('screen_mark',{action:'clear',id:result.id,expectedRevision:result.revision});
  console.log(JSON.stringify({checkoutRequired:false,relocated:true,renderer:'copied Electron',displays:screens.displays.length,markAndClear:'passed',modelCalls:0},null,2));
}finally{
  await client.close();
  const live=await readManifest(dir);if(live){try{process.kill(live.pid,'SIGTERM');}catch{/* Already stopped. */}}
  for(let i=0;i<100;i++){if(!await readManifest(dir))break;await new Promise(r=>setTimeout(r,25));}
  await rm(base,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
