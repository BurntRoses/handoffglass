import test from 'node:test';
import assert from 'node:assert/strict';
import {createHostAdapter,HARNESS_ORDER} from '../src/hosts/adapter.mjs';
import {nativeTools} from '../src/hosts/native-tools.mjs';
import {toolCatalog} from '../src/mcp.mjs';
import {HandoffManager} from '../src/core.mjs';
import {LocalBridge} from '../src/bridge.mjs';
import {BrokerClient,writeManifest} from '../src/runtime.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('all seven adapters keep observation and verification with their host; only verified work can resume',async()=>{
 for(const host of HARNESS_ORDER){
  const calls=[],broker={present:async(mode,args)=>{calls.push(args);return {session:{id:'s',verified:false}};},verify:async(id,result)=>({session:{id,verified:result==='verified',verification:{result}}})};
  let result='inconclusive';const adapter=createHostAdapter(host,{broker,verify:async()=>result});
  assert.equal((await adapter.observe()).error,'host_observation_required');
  assert.equal((await adapter.verify({sessionId:'unknown'})).error,'not_found');
  await adapter.present({title:'Open',message:'Original app'});assert.equal(calls[0].continuous,true);assert.equal(calls[0].execution,'parked');
  assert.equal((await adapter.resume({sessionId:'s'})).error,'independent_verification_required');
  assert.equal((await adapter.verify({sessionId:'s'})).session.verification.result,'inconclusive');
  result='verified';await adapter.verify({sessionId:'s'});assert.deepEqual((await adapter.resume({sessionId:'s'})).hostWakeup,false);
 }
});
test('native hosts reuse all host-profile MCP schemas and never share ownership between chats',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'hg-native-tools-')),m=new HandoffManager(),b=new LocalBridge(m,{headless:true});
 const previous=process.env.HANDOFFGLASS_RUNTIME_DIR;process.env.HANDOFFGLASS_RUNTIME_DIR=dir;
 await b.start();await writeManifest(dir,{pid:process.pid,port:b.port,token:b.agentToken});
 const tools=nativeTools('opencode',{clientFactory:()=>new BrokerClient({env:{...process.env,HANDOFFGLASS_RUNTIME_DIR:dir,HANDOFFGLASS_HOST_ID:'opencode'}})});
 try{
  assert.deepEqual(tools.definitions.map(x=>x.name),[...toolCatalog(undefined).keys()]);assert.equal(tools.definitions.length,18);
  await assert.rejects(tools.execute('session_start',{title:'a',message:'b'}),/identity/);
  const s=await tools.execute('session_start',{title:'Open settings',message:'In the original app',requestId:'native-step-1'},{identity:'chat-A'});
  assert.equal(s.session.execution,'parked');
  await assert.rejects(tools.execute('session_start',{title:'Other',message:'App'},{identity:'chat-B'}),e=>e.code==='busy');
  await assert.rejects(tools.execute('session_stop',{sessionId:s.session.id},{identity:'chat-B'}),e=>e.code==='not_found');
  const controller=new AbortController();controller.abort();await assert.rejects(tools.execute('screen_displays',{}, {identity:'chat-A',signal:controller.signal}),{name:'AbortError'});
  m.resolve(s.session.id,'completed');
  const pending=await tools.execute('session_verify',{sessionId:s.session.id,result:'inconclusive'},{identity:'chat-A'});assert.equal(pending.session.nextAction,'request_independent_evidence');
  await tools.execute('session_verify',{sessionId:s.session.id,result:'verified',finish:true},{identity:'chat-A'});
  tools.close();await assert.rejects(tools.execute('screen_displays',{}, {identity:'chat-A'}),/disposed/);
 }finally{m.close();await b.stop();if(previous===undefined)delete process.env.HANDOFFGLASS_RUNTIME_DIR;else process.env.HANDOFFGLASS_RUNTIME_DIR=previous;await rm(dir,{recursive:true,force:true});}
});
