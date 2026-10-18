#!/usr/bin/env node
/** Launch packaged Electron in Node mode and verify its *bundled* MCP stdio entry. */
import { readdir, access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
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
  await rm(dir,{recursive:true,force:true});
}
