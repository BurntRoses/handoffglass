#!/usr/bin/env node
/** Move a complete plugin and run its copied MCP + renderer, without the source entry or installed App. */
import assert from 'node:assert/strict';
import {mkdtemp,rename,rm,readFile,cp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {buildCodexPlugin} from '../src/codex-plugin.mjs';
import {readManifest} from '../src/runtime.mjs';
import {savePreferences} from '../src/local/preferences.mjs';
import {packagedRuntime} from '../src/release-contract.mjs';
const base=await mkdtemp(join(tmpdir(),'hg-portable-runtime-')),dir=join(base,'state'),client=new Client({name:'relocated-plugin',version:'1'});
try{
  await savePreferences({theme:'light'},dir);
  const packaged=process.argv.includes('--packaged');let build;
  if(packaged){
    let runtime=await packagedRuntime(resolve(process.env.HANDOFFGLASS_DIST_DIR||`dist/desktop-${process.platform}-${process.arch}`));
    // Match the installed Windows directory identity without altering the build.
    if(process.platform==='win32'){
      const app=join(base,'HandoffGlass');await cp(dirname(runtime.binary),app,{recursive:true});
      runtime={binary:join(app,'HandoffGlass.exe'),resources:join(app,'resources')};
    }
    const root=join(runtime.resources,'app.asar'),appPath=process.platform==='darwin'?resolve(runtime.resources,'../..'):dirname(runtime.binary);
    const {stdout}=await promisify(execFile)(runtime.binary,['--input-type=module','-e',`
      const {registerApplicationInstallation}=await import(${JSON.stringify(pathToFileURL(join(root,'src/application-installation.mjs')).href)});
      const {buildCodexPlugin}=await import(${JSON.stringify(pathToFileURL(join(root,'src/codex-plugin.mjs')).href)});
      await registerApplicationInstallation({dir:${JSON.stringify(dir)},appPath:${JSON.stringify(appPath)}});
      const build=await buildCodexPlugin({output:${JSON.stringify(join(base,'market'))},desktopRuntime:true,envOverrides:{ELECTRON_RUN_AS_NODE:'1'}});
      process.stdout.write(JSON.stringify(build));
    `],{env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},timeout:60000,maxBuffer:1024*1024});
    build=JSON.parse(stdout);assert.equal(build.runtimeMode,'app-linked');assert.equal(build.desktopRuntime,false);
  }else build=await buildCodexPlugin({output:join(base,'market'),desktopRuntime:true});
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
  console.log(JSON.stringify({checkoutRequired:false,relocated:true,renderer:packaged?'registered App':'copied Electron',displays:screens.displays.length,markAndClear:'passed',modelCalls:0},null,2));
}finally{
  await client.close();
  const live=await readManifest(dir);if(live){try{process.kill(live.pid,'SIGTERM');}catch{/* Already stopped. */}}
  for(let i=0;i<100;i++){if(!await readManifest(dir))break;await new Promise(r=>setTimeout(r,25));}
  await rm(base,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
