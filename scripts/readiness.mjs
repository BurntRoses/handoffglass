#!/usr/bin/env node
/** No screenshots, no app enumeration, no network and no personal paths printed. */
import { createRequire } from 'node:module';
import { platform } from 'node:os';
import { runtimeDir, readManifest, probe } from '../src/runtime.mjs';
import { assessReadiness } from '../src/local/readiness.mjs';
import { desktopRuntimeStatus } from '../src/local/desktop-runtime.mjs';
const require=createRequire(import.meta.url);
const installed=p=>{try{return Boolean(require.resolve(p))}catch{return false}};
const hasDesktop = platform() === 'win32' ? Boolean(process.env.SESSIONNAME &&
  !/^services$/i.test(process.env.SESSIONNAME)) :
  platform() === 'darwin' ? Boolean(process.env.HOME && !process.env.CI) :
    Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
const broker=await readManifest(runtimeDir()).catch(()=>null);
const result=assessReadiness({
  nodeMajor:Number(process.versions.node.split('.')[0]), platform:platform(),
  coreAvailable:installed('@modelcontextprotocol/server') && installed('zod'),
  electronAvailable:desktopRuntimeStatus().available, desktopSession:hasDesktop,
  brokerConnected:broker ? await probe(broker):false,
  accessibilityOptIn:process.env.HANDOFFGLASS_ENABLE_ACCESSIBILITY==='1',
  accessibilityReady:false // No OS accessibility probe is silently performed.
});
if(process.argv.includes('--json')) console.log(JSON.stringify(result,null,2));
else {
  console.log('HandoffGlass · Local readiness\n');
  for(const c of result.checks) console.log(`${c.status.toUpperCase().padEnd(9)} ${c.id.padEnd(19)} ${c.info}`);
  console.log('\nCore usable:',result.coreReady?'yes':'no');
  console.log('Desktop verified: no · physical GUI test still required');
}
if(!result.coreReady) process.exitCode=1;
