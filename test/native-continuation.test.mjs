import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createContinuation,continuationMessage} from '../src/hosts/continuation.mjs';
import {handleClaudeHook} from '../src/hosts/claude-hooks.mjs';
import {hostHookDirectory} from '../src/hosts/codex-hooks.mjs';
import {nativeTools} from '../src/hosts/native-tools.mjs';
import {HandoffManager} from '../src/core.mjs';
import {LocalBridge} from '../src/bridge.mjs';
import {BrokerClient,writeManifest} from '../src/runtime.mjs';

const session=(overrides={})=>({id:'s',step:1,status:'awaiting_user',execution:'attached',nextAction:'wait_for_user',updatedAt:1,...overrides});
function deferredBroker(){
 const requests=[],cancelled=[],controls=[];
 const broker={
  withSignal(signal){return {wait:(id,seconds,options)=>new Promise(resolve=>{
   const end=()=>resolve({session:session(),events:[],nextCursor:options.cursor});signal.addEventListener('abort',end,{once:true});
   requests.push({id,options,signal,resolve:result=>{signal.removeEventListener('abort',end);resolve(result);}});
  })};},
  cancel:async id=>{cancelled.push(id);},
  control:async(id,action,phase,step)=>{controls.push({id,action,phase,step});return {session:session({status:action==='pause'?'paused':'awaiting_user'})};}
 };return {broker,requests,cancelled,controls};
}
test('native delivery stays asleep while parked and coalesces user report and verification into one notice',async()=>{
 const fake=deferredBroker(),notices=[],c=createContinuation({broker:fake.broker,deliver:async n=>notices.push(n)});
 c.update({session:session({execution:'parked'})});await delay(0);assert.equal(fake.requests.length,0);
 c.update({session:session(),nextCursor:3});await delay(0);assert.equal(fake.requests[0].options.cursor,3);
 const report=session({status:'user_action_reported',nextAction:'verify_in_app',updatedAt:2});
 fake.requests[0].resolve({session:report,nextCursor:5,events:[{sessionId:'s',sequence:4,type:'user_action'},{sessionId:'s',sequence:5,type:'verification_required'}]});
 await delay(0);assert.equal(notices.length,1);assert.deepEqual(notices[0].events,['user_action','verification_required']);
 assert.match(continuationMessage(notices[0]),/Independently observe/);
 fake.requests[1].resolve({session:report,nextCursor:6,events:[{sessionId:'s',sequence:6,type:'verification_required'}]});
 await delay(0);assert.equal(notices.length,1);
 await c.close();assert.deepEqual(fake.cancelled,['s']);assert.equal(fake.requests.at(-1).signal.aborted,true);
});
test('terminal refusal and disabled transport stop native delivery without waking or retrying',async()=>{
 for(const state of ['declined','cancelled','expired']){
  const fake=deferredBroker(),notices=[],c=createContinuation({broker:fake.broker,deliver:async n=>notices.push(n)});
  c.update({session:session()});await delay(0);
  fake.requests[0].resolve({session:session({status:state}),nextCursor:1,events:[{sessionId:'s',sequence:1,type:'session_finished'}]});await delay(0);
  assert.deepEqual(notices,[]);assert.equal(fake.requests.length,1);await c.close();assert.deepEqual(fake.cancelled,[]);
 }
 const errors=[],c=createContinuation({broker:{wait:async()=>{throw Object.assign(Error('disabled'),{code:'disabled_by_user'});}},deliver:async()=>assert.fail('No delivery'),onError:e=>errors.push(e.code)});
 c.update({session:session()});await delay(0);assert.deepEqual(errors,['disabled_by_user']);await c.close({cancel:false});
});
test('late previous-step events cannot overwrite a new step or deliver to it',async()=>{
 const fake=deferredBroker(),notices=[],c=createContinuation({broker:fake.broker,deliver:async n=>notices.push(n)});
 c.update({session:session()});await delay(0);c.update({session:session({step:2,updatedAt:4})});
 fake.requests[0].resolve({session:session({updatedAt:2}),nextCursor:1,events:[{sessionId:'s',sequence:1,type:'user_action'}]});await delay(0);
 assert.equal(c.session.step,2);assert.equal(notices.length,0);await c.close();
});
test('failed native admission is not retried, and disposing parked guidance preserves it',async()=>{
 const fake=deferredBroker(),errors=[];let attempts=0;
 const c=createContinuation({broker:fake.broker,deliver:async()=>{attempts++;throw Error('Host unavailable');},onError:error=>errors.push(error.message)});
 c.update({session:session()});await delay(0);
 const report=session({status:'user_action_reported',nextAction:'verify_in_app',updatedAt:2});
 fake.requests[0].resolve({session:report,nextCursor:1,events:[{sessionId:'s',sequence:1,type:'user_action'}]});await delay(0);
 assert.equal(attempts,1);assert.equal(fake.requests.length,1);assert.deepEqual(errors,['Host unavailable']);
 // A subsequent host progress update can restart transport, never the same admission.
 c.update({session:report});await delay(0);
 fake.requests[1].resolve({session:report,nextCursor:2,events:[{sessionId:'s',sequence:2,type:'verification_required'}]});await delay(0);
 assert.equal(attempts,1);await c.close();
 const parked=deferredBroker(),p=createContinuation({broker:parked.broker,deliver:async()=>assert.fail('Parked must not wake')});
 p.update({session:session({execution:'parked'})});await p.close();assert.deepEqual(parked.cancelled,[]);assert.equal(parked.requests.length,0);
});
test('native tool event delivery uses the original chat owner and does not mark user reports verified',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'hg-native-events-')),manager=new HandoffManager(),bridge=new LocalBridge(manager,{headless:true});
 const previous=process.env.HANDOFFGLASS_RUNTIME_DIR;process.env.HANDOFFGLASS_RUNTIME_DIR=dir;
 let resolveNotice;const received=new Promise(resolve=>{resolveNotice=resolve;});
 const tools=nativeTools('deepseek',{clientFactory:()=>new BrokerClient({env:{...process.env,HANDOFFGLASS_RUNTIME_DIR:dir,HANDOFFGLASS_HOST_ID:'deepseek'}}),deliver:async(identity,notice)=>resolveNotice({identity,notice})});
 try{
  await bridge.start();await writeManifest(dir,{pid:process.pid,port:bridge.port,token:bridge.agentToken});
  const result=await tools.execute('session_start',{title:'Fixture',message:'Review fixture',execution:'attached',requestId:'native-event-test'},{identity:'original-chat'});
  manager.resolve(result.session.id,'completed');
  const event=await Promise.race([received,delay(2000).then(()=>{throw Error('Native notice was not delivered');})]);
  assert.equal(event.identity,'original-chat');assert.equal(event.notice.sessionId,result.session.id);assert.equal(manager.get(result.session.id).verified,false);
  await assert.rejects(tools.execute('session_stop',{sessionId:result.session.id},{identity:'another-chat'}),e=>e.code==='not_found');
  await tools.interrupt('original-chat');assert.equal(manager.get(result.session.id).status,'paused');
  await tools.close();assert.equal(manager.get(result.session.id).status,'cancelled');
 }finally{
  await tools.close();manager.close();await bridge.stop();if(previous===undefined)delete process.env.HANDOFFGLASS_RUNTIME_DIR;else process.env.HANDOFFGLASS_RUNTIME_DIR=previous;await rm(dir,{recursive:true,force:true});
 }
});
test('Claude hooks bind only their own MCP result and keep Hook storage separate from Codex',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'hg-claude-hooks-')),env={HANDOFFGLASS_RUNTIME_DIR:dir},calls=[];
 const id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',resumeToken='b'.repeat(64);
 const request=async(_env,state,event,phase)=>{calls.push({state,event,phase});return {session:{id,status:'awaiting_user',step:1,execution:'attached',phase:'waiting_user',nextAction:'wait_for_user'}};};
 const base={session_id:'claude-chat',hook_event_name:'PostToolUse',tool_name:'mcp__handoffglass__session_start',tool_response:{session:{id,step:1,execution:'attached'},resumeToken}};
 try{
  await handleClaudeHook(base,{env,request});assert.equal(calls[0].event,'bind');
  assert.notEqual(hostHookDirectory('codex',env),hostHookDirectory('claude-code',env));
  await handleClaudeHook({session_id:'another-chat',hook_event_name:'UserPromptSubmit'},{env,request});assert.equal(calls.length,1);
  await handleClaudeHook({session_id:'claude-chat',hook_event_name:'UserPromptSubmit'},{env,request});assert.equal(calls.at(-1).phase,'thinking');
  const stopped=await handleClaudeHook({session_id:'claude-chat',hook_event_name:'Stop'},{env,request});assert.equal(stopped.decision,'block');
  assert.deepEqual(await handleClaudeHook({session_id:'claude-chat',hook_event_name:'Stop'},{env,request}),{});
  await handleClaudeHook({session_id:'claude-chat',hook_event_name:'SessionEnd'},{env,request});assert.equal(calls.at(-1).event,'end');
 }finally{await rm(dir,{recursive:true,force:true});}
});
