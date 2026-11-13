#!/usr/bin/env node
/** Launch packaged Electron in Node mode and verify its *bundled* MCP stdio entry. */
import { readdir, readFile, access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { readManifest } from '../src/runtime.mjs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { packagedRuntime } from '../src/release-contract.mjs';
import {capabilityInstructions} from '../src/capabilities.mjs';
const dist=resolve(process.env.HANDOFFGLASS_DIST_DIR || `dist/desktop-${process.platform}-${process.arch}`);
const {binary:appBinary,entry}=await packagedRuntime(dist);
await access(appBinary); // do not stat virtual files inside asar
// The packaged MCP entry bypasses app.mjs. Its native helper must still resolve
// outside ASAR, without relying on a system Node/Swift installation.
const nativeEnv = { ...process.env, ELECTRON_RUN_AS_NODE: '1' };
delete nativeEnv.HANDOFFGLASS_NATIVE_RESOURCE_DIR;
const locatorURL = pathToFileURL(join(dirname(entry), 'native/locator.mjs')).href;
const { stdout } = await promisify(execFile)(appBinary, ['--input-type=module', '-e',
  `const {nativeCommand}=await import(${JSON.stringify(locatorURL)}); process.stdout.write(JSON.stringify(nativeCommand()));`],
  { env: nativeEnv, timeout: 15000 });
const native = JSON.parse(stdout);
const resources = dirname(dirname(dirname(entry)));
if (process.platform === 'darwin') {
  assert.equal(native.command, join(resources, 'native/hg-locate'));
  await access(native.command);
} else {
  assert.equal(native.args.at(-1), join(resources, 'native/locate.ps1'));
  await access(native.args.at(-1));
}
console.log('Packaged native helper resolves outside ASAR');
const dir=await mkdtemp(join(tmpdir(),'hg-packaged-test-'));
const client=new Client({name:'handoffglass-packaged-smoke',version:'0.6.0'});
try{
  const transport=new StdioClientTransport({command:appBinary,args:[entry],env:{...process.env,
    ELECTRON_RUN_AS_NODE:'1',HANDOFFGLASS_HEADLESS:'1',HANDOFFGLASS_RUNTIME_DIR:dir},stderr:'pipe'});
  await Promise.race([client.connect(transport),new Promise((_r,reject)=>setTimeout(()=>reject(new Error('Packaged MCP connection timeout')),15000))]);
  const {tools}=await client.listTools();
  assert.ok((client.getInstructions() || '').length <= 512);
  assert.equal(client.getInstructions(),capabilityInstructions());
  assert.ok(tools.some(t=>t.name==='session_start'));
  assert.ok(tools.some(t=>t.name==='ui_locate'));
  assert.ok(tools.some(t=>t.name==='ui_inspect'));
  const installURL=pathToFileURL(join(dirname(entry),'codex-install.mjs')).href;
  await promisify(execFile)(appBinary,['--input-type=module','-e',
    `const {installCodex}=await import(${JSON.stringify(installURL)}); await installCodex({userHome:${JSON.stringify(dir)},codexHome:${JSON.stringify(join(dir,'codex'))},apply:true});`],
    {env:nativeEnv,timeout:15000});
  console.log('Packaged Codex installer and bundled guidance skill verified');
  const bundleURL=pathToFileURL(join(dirname(entry),'workbuddy-bundle.mjs')).href;
  const lifecycleURL=pathToFileURL(join(dirname(entry),'integration-lifecycle.mjs')).href;
  const bundle=join(dir,'connectors','workbuddy-local');
  await promisify(execFile)(appBinary,['--input-type=module','-e',
    `const {prepareWorkbuddyBundle}=await import(${JSON.stringify(bundleURL)}); await prepareWorkbuddyBundle(${JSON.stringify(bundle)},{envOverrides:{ELECTRON_RUN_AS_NODE:'1'}});`],
    {env:nativeEnv,timeout:15000});
  const connector=JSON.parse(await readFile(join(bundle,'mcp.json'),'utf8'));
  assert.equal(connector.mcpServers.handoffglass.command,appBinary);
  assert.equal(connector.mcpServers.handoffglass.env.ELECTRON_RUN_AS_NODE,'1');
  assert.ok(JSON.parse(await readFile(join(bundle,'connector-meta.json'),'utf8')).minWorkbuddyVersion);
  assert.match(await readFile(join(bundle,'skills/visual-handoff/references/tool-contracts.md'),'utf8'),/session_wait/);
  await promisify(execFile)(appBinary,['--input-type=module','-e',
    `const {cleanupIntegration}=await import(${JSON.stringify(lifecycleURL)}); await cleanupIntegration('workbuddy',{dir:${JSON.stringify(dir)},root:${JSON.stringify(dirname(dirname(entry)))},confirm:true});`],
    {env:nativeEnv,timeout:15000});
  await assert.rejects(access(join(bundle,'mcp.json')),{code:'ENOENT'});
  console.log('Packaged WorkBuddy metadata, MCP, Skill and owned bundle cleanup verified');
  // Exercise the App's real connection-building modules inside ASAR. A source
  // checkout smoke cannot catch missing templates or a nested Electron request.
  // These are bundle fixtures only: no host CLI, trust or configuration is used.
  const codexPluginURL=pathToFileURL(join(dirname(entry),'codex-plugin.mjs')).href;
  const harnessPluginURL=pathToFileURL(join(dirname(entry),'harness-plugin.mjs')).href;
  const packagedRoot=dirname(dirname(entry)),connectionsRoot=join(dir,'app-linked-connections');
  const {stdout:connectionsJSON}=await promisify(execFile)(appBinary,['--input-type=module','-e',`
    import assert from 'node:assert/strict';
    import {readFile,access} from 'node:fs/promises';
    import {join} from 'node:path';
    const {buildCodexPlugin}=await import(${JSON.stringify(codexPluginURL)});
    const {buildHarnessPlugin,HARNESS_BUNDLE_HOSTS}=await import(${JSON.stringify(harnessPluginURL)});
    const base=${JSON.stringify(connectionsRoot)},root=${JSON.stringify(packagedRoot)};
    const command=process.execPath,envOverrides={ELECTRON_RUN_AS_NODE:'1'};
    const codex=await buildCodexPlugin({root,command,output:join(base,'codex'),desktopRuntime:true,runtimeLink:'stable',envOverrides});
    const results=[{host:'codex',output:codex.marketplaceRoot,pluginPath:codex.pluginPath,
      metadata:JSON.parse(await readFile(join(codex.pluginPath,'local-runtime.json'),'utf8')),result:codex}];
    for(const host of HARNESS_BUNDLE_HOSTS){
      const built=await buildHarnessPlugin({host,root,command,output:join(base,host),desktopRuntime:true,envOverrides});
      results.push({host,output:built.output,pluginPath:built.output,
        metadata:JSON.parse(await readFile(join(built.output,'runtime-evidence.json'),'utf8')),result:built});
    }
    for(const item of results){
      assert.equal(item.result.desktopRuntime,false,item.host+' must reuse the App renderer');
      assert.equal(item.result.runtimeMode,'app-linked');
      assert.equal(item.metadata.desktopRuntime,false);
      assert.equal(item.metadata.runtimeMode,'app-linked');
      await assert.rejects(access(join(item.pluginPath,'runtime/node_modules/electron')),{code:'ENOENT'});
      if(item.host==='codex')item.server=JSON.parse(await readFile(join(item.pluginPath,'.mcp.json'),'utf8')).mcpServers.handoffglass;
      else item.server={command,args:[join(item.pluginPath,'runtime/src/mcp.mjs')],env:JSON.parse(await readFile(join(item.pluginPath,'connection.json'),'utf8')).env};
      assert.equal(item.server.command,command);
      assert.equal(item.server.env.HANDOFFGLASS_RUNTIME_MODE,'app-linked');
      assert.equal(item.server.env.HANDOFFGLASS_EMBEDDED_RENDERER,undefined);
      delete item.result;delete item.metadata;
    }
    process.stdout.write(JSON.stringify(results));
  `],{env:nativeEnv,timeout:60000,maxBuffer:1024*1024});
  const connections=JSON.parse(connectionsJSON);
  assert.deepEqual(connections.map(item=>item.host),['codex','claude-code','deepseek','opencode','cursor','trae']);
  for(const item of connections){
    const copiedClient=new Client({name:'handoffglass-packaged-'+item.host,version:'0.23.0'});
    let timer;
    try{
      const copiedTransport=new StdioClientTransport({command:item.server.command,args:item.server.args,
        env:{...process.env,...item.server.env,HANDOFFGLASS_HEADLESS:'1',HANDOFFGLASS_RUNTIME_DIR:dir},stderr:'pipe'});
      await Promise.race([copiedClient.connect(copiedTransport),new Promise((_r,reject)=>{
        timer=setTimeout(()=>reject(new Error('App-linked MCP connection timeout: '+item.host)),15000);
      })]);
      const copiedTools=await copiedClient.listTools();
      assert.equal(copiedTools.tools.length,19,item.host+' must expose the host tool profile');
      for(const name of ['screen_mark','session_start','session_wait','connection_status'])
        assert.ok(copiedTools.tools.some(tool=>tool.name===name),item.host+' missing '+name);
    }finally{clearTimeout(timer);await copiedClient.close().catch(()=>{});}
  }
  // Run ownership-aware deletion from the packaged code as well. Codex's plan
  // is applied locally; its actual native removal command belongs to real-host
  // acceptance and must never be called by this isolated packaging fixture.
  const codexLifecycleURL=pathToFileURL(join(dirname(entry),'codex-plugin-lifecycle.mjs')).href;
  const managedFilesURL=pathToFileURL(join(dirname(entry),'managed-files.mjs')).href;
  await promisify(execFile)(appBinary,['--input-type=module','-e',`
    import assert from 'node:assert/strict';
    import {mkdir,readFile,writeFile,access} from 'node:fs/promises';
    import {join} from 'node:path';
    const {removeHarnessPlugin}=await import(${JSON.stringify(harnessPluginURL)});
    const {codexPluginPlan}=await import(${JSON.stringify(codexLifecycleURL)});
    const {applyFileTransaction,removeEmptyParents}=await import(${JSON.stringify(managedFilesURL)});
    const connections=${JSON.stringify(connections)};
    for(const item of connections){
      const note=join(item.output,'my-note.txt');await writeFile(note,'Keep my connection notes.');
      let retained;
      if(item.host==='codex'){
        const codexHome=join(${JSON.stringify(connectionsRoot)},'codex-profile');await mkdir(codexHome);
        await writeFile(join(codexHome,'handoffglass-plugin-install.json'),JSON.stringify({version:1,plugin:'handoffglass@handoffglass-local',marketplaceRoot:item.output,command:process.execPath}));
        const plan=await codexPluginPlan({codexHome,dir:${JSON.stringify(dir)}});
        assert.ok(plan.changes.length);assert.ok(plan.retained.some(entry=>entry.path===note));
        await applyFileTransaction(plan.changes);
        for(const change of plan.changes)await removeEmptyParents(change.path,item.output);
        retained=plan.retained;
      }else retained=(await removeHarnessPlugin({host:item.host,output:item.output,confirm:true})).retained;
      assert.ok(retained.some(entry=>entry.path===note),item.host+' must retain user files');
      assert.equal(await readFile(note,'utf8'),'Keep my connection notes.');
      await assert.rejects(access(join(item.pluginPath,'runtime/src/mcp.mjs')),{code:'ENOENT'});
    }
  `],{env:nativeEnv,timeout:60000,maxBuffer:1024*1024});
  console.log('Packaged App builds, loads and cleans six App-linked connection bundles without nested Electron or host commands');
  const applicationURL=pathToFileURL(join(dirname(entry),'application-installation.mjs')).href;
  const uninstallOptions={dir:join(dir,'uninstall-runtime'),userHome:join(dir,'uninstall-home'),codexHome:join(dir,'uninstall-codex'),root:dirname(dirname(entry))};
  const {stdout:uninstallResult}=await promisify(execFile)(appBinary,['--input-type=module','-e',`
    import {readFile,rm} from 'node:fs/promises';
    import {dirname} from 'node:path';
    const {registerApplicationInstallation}=await import(${JSON.stringify(applicationURL)});
    const {uninstallApplication}=await import(${JSON.stringify(lifecycleURL)});
    const {installCodex}=await import(${JSON.stringify(installURL)});
    const options=${JSON.stringify(uninstallOptions)};
    await registerApplicationInstallation(options);await installCodex({...options,apply:true});
    const applied=await uninstallApplication({...options,confirm:true,waitPids:[]});
    let result;for(let i=0;i<200;i++){try{result=JSON.parse(await readFile(applied.resultPath,'utf8'));break;}catch{}await new Promise(r=>setTimeout(r,50));}
    if(!result?.complete)throw new Error('Packaged external remover did not complete: '+JSON.stringify(result));
    await rm(dirname(applied.resultPath),{recursive:true,force:true,maxRetries:12,retryDelay:150});console.log('complete');
  `],{env:nativeEnv,timeout:20000});
  assert.equal(uninstallResult.trim(),'complete');
  await assert.rejects(access(uninstallOptions.dir),{code:'ENOENT'});
  console.log('Packaged external full-uninstall worker verified in an isolated installation');
  const status=await client.callTool({name:'screen_displays',arguments:{}});
  assert.ok(!status.isError); // headless fixture returns a valid empty-display status
  console.log('Packaged ELECTRON_RUN_AS_NODE MCP handshake complete:',tools.length,'tools');
}finally{
  await client.close().catch(()=>{});
  // The MCP client starts a detached, single-instance *headless Broker* in this
  // isolated test runtime. Killing only the stdio child leaves HandoffGlass.exe
  // owning broker.json on Windows (observed in GitHub Actions run 39146346211).
  // Stop the Broker explicitly before deleting its directory. Only the unique
  // test runtime PID is eligible; never stop another user's shared Broker.
  const broker = await readManifest(dir);
  if (broker && broker.pid !== process.pid) {
    try { process.kill(broker.pid, 'SIGTERM'); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
    const stopDeadline = Date.now() + 10000;
    while (Date.now() < stopDeadline) {
      try { process.kill(broker.pid, 0); }
      catch (error) {
        if (error.code === 'ESRCH' || error.code === 'EPERM') break;
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 120));
    }
  }
  // On Windows a just-closed Electron child can briefly retain a handle to its
  // temporary runtime files. Retry transient OS locks, but fail after a bound.
  await rm(dir,{recursive:true,force:true,maxRetries:12,retryDelay:250});
}
