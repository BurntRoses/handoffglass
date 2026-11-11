/** Packaged relaunch and source-Broker join, isolated from the user's runtime. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {packagedRuntime} from '../src/release-contract.mjs';
import {ensureBroker,readManifest,probe,BrokerClient} from '../src/runtime.mjs';
import {savePreferences} from '../src/local/preferences.mjs';
const {binary}=await packagedRuntime(resolve(process.env.HANDOFFGLASS_DIST_DIR||`dist/final-${process.platform}-${process.arch}`));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<150;i++){if(await fn())return;await pause(50);}throw Error(label);}
for(const mode of ['self-host','join-source-broker']) {
  const dir=await mkdtemp(join(tmpdir(),'hg-single-')),env={...process.env,HANDOFFGLASS_RUNTIME_DIR:dir};
  delete env.HANDOFFGLASS_HEADLESS;delete env.ELECTRON_RUN_AS_NODE;delete env.HANDOFFGLASS_PORT;delete env.HANDOFFGLASS_SECRET;
  await savePreferences({theme:'system'},dir);
  let first,duplicate,live,stderr='';
  try {
    if(mode==='join-source-broker')live=await ensureBroker({env});
    first=spawn(binary,[],{env,stdio:['ignore','ignore','pipe']});first.stderr.on('data',c=>stderr+=String(c));
    await until(async()=>{live=await readManifest(dir);return live&&await probe(live);},'No Broker: '+stderr);
    const client=new BrokerClient({env});
    await until(async()=>{const s=await client.connection();return s.desktop==='ready';},'Desktop did not attach');
    assert.equal(first.exitCode,null,stderr);
    if(mode==='self-host')assert.equal(live.pid,first.pid);
    else assert.notEqual(live.pid,first.pid);
    duplicate=spawn(binary,[],{env,stdio:'ignore'});
    await until(()=>duplicate.exitCode!==null,'Duplicate did not exit');assert.equal(duplicate.exitCode,0);
    assert.equal(first.exitCode,null,'Original desktop exited');assert.equal((await readManifest(dir)).pid,live.pid);
    const displays=await client.displays();assert.ok(displays.connected);assert.ok(displays.displays.length);
    const mark=await client.mark({requestId:'single-instance-mark'});assert.equal(mark.visible,true);
    await client.cancel(mark.id);assert.equal((await readManifest(dir)).pid,live.pid);
    console.log(`PASS ${mode}: one surviving desktop, reused Broker, real screen mark`);
  }finally{
    if(duplicate?.exitCode===null)duplicate.kill();if(first?.exitCode===null)first.kill();
    if(live && live.pid!==first?.pid)try{process.kill(live.pid,'SIGTERM');}catch{}
    await pause(250);await rm(dir,{recursive:true,force:true,maxRetries:10,retryDelay:100});
  }
}
