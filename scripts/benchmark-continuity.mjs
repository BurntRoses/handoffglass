#!/usr/bin/env node
/** In-process loopback latency only. No external model or host performance claim. */
import {performance} from 'node:perf_hooks';
import {HandoffManager} from '../src/core.mjs';
import {LocalBridge} from '../src/bridge.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const dir=await mkdtemp(join(tmpdir(),'handoffglass-continuity-'));
process.env.HANDOFFGLASS_RUNTIME_DIR=dir;
const manager=new HandoffManager(),bridge=new LocalBridge(manager,{headless:true});
const owner='11111111-1111-4111-8111-111111111111';
const samples=[];await bridge.start();
const url=`http://127.0.0.1:${bridge.port}`,agent={authorization:`Bearer ${bridge.agentToken}`,'x-handoffglass-owner':owner};
try{
 for(let i=0;i<60;i++){
  const session=manager.show({title:'Benchmark',message:'Loopback only',mode:'handoff',continuous:true},owner);
  const cursor=bridge.journal.read(session.id).nextCursor;
  const controller=new AbortController();
  const pending=fetch(url+`/agent/wait?continuous=1&sessionId=${session.id}&cursor=${cursor}&maxWaitMs=30000`,{headers:agent,signal:controller.signal}).then(r=>r.json());
  const deadline=performance.now()+5000;
  while(!bridge.journal.pendingWaits){if(performance.now()>deadline)throw Error('Wait did not subscribe');await new Promise(resolve=>setImmediate(resolve));}
  const start=performance.now();manager.resolve(session.id,'completed');const recorded=performance.now();
  const result=await pending;controller.abort();
  if(result.session?.phase!=='verifying')throw Error('Missing verification event');
  samples.push({broker:recorded-start,event:performance.now()-start});manager.verify(session.id,owner,true,true);
 }
 const stats=key=>{const values=samples.slice(5).map(x=>x[key]).sort((a,b)=>a-b);return {p50Ms:+values[Math.floor(values.length*.5)].toFixed(2),p95Ms:+values[Math.floor(values.length*.95)].toFixed(2),maxMs:+values.at(-1).toFixed(2)};};
 console.log(JSON.stringify({schemaVersion:1,scope:'subscribed cursor wait over local Node loopback; excludes OS input, Electron paint, host scheduling and model',samples:55,warmup:5,brokerRecord:stats('broker'),eventReceived:stats('event')},null,2));
}finally{await bridge.stop();manager.close();await rm(dir,{recursive:true,force:true});}
