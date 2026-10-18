#!/usr/bin/env node
/** Launch packaged Electron in Node mode and verify its *bundled* MCP stdio entry. */
import { readdir, access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { readManifest } from '../src/runtime.mjs';
const dist=resolve('dist');
let appBinary, entry;
if(process.platform==='darwin'){
  const d=(await readdir(dist)).find(x=>x.startsWith('mac'));
  const p=join(dist,d,'HandoffGlass.app','Contents');
  appBinary=join(p,'MacOS','HandoffGlass');
  entry=join(p,'Resources','app.asar','src','mcp.mjs');
}else if(process.platform==='win32'){
  appBinary=join(dist,'win-unpacked','HandoffGlass.exe');
  entry=join(dist,'win-unpacked','resources','app.asar','src','mcp.mjs');
}else throw new Error('macOS/Windows only');
await access(appBinary); // do not stat virtual files inside asar
const dir=await mkdtemp(join(tmpdir(),'hg-packaged-test-'));
const client=new Client({name:'handoffglass-packaged-smoke',version:'0.6.0'});
try{
  const transport=new StdioClientTransport({command:appBinary,args:[entry],env:{...process.env,
    ELECTRON_RUN_AS_NODE:'1',HANDOFFGLASS_HEADLESS:'1',HANDOFFGLASS_RUNTIME_DIR:dir},stderr:'pipe'});
  await Promise.race([client.connect(transport),new Promise((_r,reject)=>setTimeout(()=>reject(new Error('Packaged MCP connection timeout')),15000))]);
  const {tools}=await client.listTools();
  assert.ok(tools.some(t=>t.name==='handoff_request'));
  assert.ok(tools.some(t=>t.name==='ui_locate'));
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
