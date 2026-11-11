import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {quickMarkRequest} from '../src/visual/quick-mark.mjs';
import {HandoffManager} from '../src/core.mjs';
import {LocalBridge} from '../src/bridge.mjs';
import {formatToolResult} from '../src/output.mjs';
import {savePreferences} from '../src/local/preferences.mjs';
import {handleCodexHook} from '../src/hosts/codex-hooks.mjs';

const owner='55555555-5555-4555-8555-555555555555';
const step={continuous:true,title:'打开设置',message:'点击设置。',x:10,y:20};
const screens=[{id:'left',x:-1440,y:-200,width:1440,height:900},{id:'main',primary:true,x:0,y:0,width:1920,height:1080}];
test('quick mark places locally on primary or negative-coordinate display; validates before drawing',()=>{
  assert.deepEqual(quickMarkRequest({},screens,{}).annotations.map(a=>[a.x,a.y]),[[960,540]]);
  const a=quickMarkRequest({displayId:'left',size:800},screens,{}).annotations[0];
  assert.deepEqual([a.x,a.y,a.width],[-720,250,800]);
  assert.throws(()=>quickMarkRequest({displayId:'gone'},screens,{}),{code:'no_display'});
  for(const invalid of [{size:2},{shape:'approval'},{durationSeconds:200},{color:'red'}])assert.throws(()=>quickMarkRequest(invalid,screens,{}));
});
test('park keeps scene and ownership; user action still needs independent verification',()=>{
  const m=new HandoffManager();try{
    const s=m.show(step,owner),token=m.issueResume(s.id,owner);
    const parked=m.control(s.id,owner,'park').session;
    assert.equal(parked.annotations.length,1);assert.equal(parked.status,'awaiting_user');
    assert.equal(formatToolResult({session:parked},{compact:true}).nextAction,'yield_to_user');
    assert.equal(m.control(s.id,'other','attach').error,'not_found');
    m.control(s.id,owner,'progress','thinking');assert.equal(m.get(s.id).agentState.phase,'idle');
    m.resolve(s.id,'completed');assert.equal(m.get(s.id).verified,false);
    assert.equal(m.present(s.id,step,owner).error,'verification_due');
    assert.equal(m.exportCheckpoint().execution,'parked');
    m.control(s.id,owner,'attach');assert.equal(m.get(s.id).phase,'verifying');
    assert.equal(m.getByResumeToken(s.id,token).id,s.id);
    assert.equal(m.verify(s.id,owner,true,true).session.status,'completed');
  }finally{m.close();}
});
test('one mark call is idempotent; parked waits return immediately and survive host end',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'hg-quick-')),prior=process.env.HANDOFFGLASS_RUNTIME_DIR;
  process.env.HANDOFFGLASS_RUNTIME_DIR=dir;
  const m=new HandoffManager(),b=new LocalBridge(m,{headless:true});
  await b.start();b.displays=screens;
  const request=async(path,body)=>{
    const r=await fetch(`http://127.0.0.1:${b.port}${path}`,{method:body?'POST':'GET',headers:{authorization:`Bearer ${b.agentToken}`,'content-type':'application/json','x-handoffglass-owner':owner},...(body?{body:JSON.stringify(body)}:{})});
    return {status:r.status,body:await r.json()};
  };
  try {
    const first=await request('/agent/mark',{requestId:'one-quick-mark'});
    assert.equal(first.status,200);assert.equal(first.body.nextAction,'done');assert.equal(first.body.session,undefined);
    assert.equal((await request('/agent/mark',{requestId:'one-quick-mark'})).body.id,first.body.id);
    m.resolve(first.body.id,'cancelled',owner);
    const s=m.show({...step,execution:'parked'},owner),resumeToken=m.issueResume(s.id,owner);
    const start=performance.now(),wait=await request(`/agent/wait?continuous=1&sessionId=${s.id}&cursor=${b.journal.latestCursor(s.id)}&maxWaitMs=30000`);
    assert.equal(wait.body.nextAction,'yield_to_user');assert.ok(performance.now()-start<300);
    assert.equal(b.agentWaits.size,0);
    const hook={sessionId:s.id,resumeToken,hostSession:'a'.repeat(64),expectedStep:1};
    assert.equal((await request('/agent/plugin-hook',{...hook,event:'bind'})).status,200);
    await request('/agent/plugin-hook',{...hook,event:'end'});
    assert.equal(m.get(s.id).execution,'parked');assert.equal(m.get(s.id).status,'awaiting_user');
    m.control(s.id,owner,'attach');
    const cursor=b.journal.latestCursor(s.id);
    const pending=request(`/agent/wait?continuous=1&sessionId=${s.id}&cursor=${cursor}&maxWaitMs=30000`);
    while(!b.agentWaits.size)await new Promise(r=>setImmediate(r));
    m.control(s.id,owner,'park');
    assert.equal((await pending).body.nextAction,'yield_to_user');
    m.resolve(s.id,'completed');m.verify(s.id,owner,true,true);
    const ended=await request(`/agent/wait?continuous=1&sessionId=${s.id}&cursor=${b.journal.latestCursor(s.id)}&maxWaitMs=30000`);
    assert.equal(ended.body.pending,false);assert.equal(ended.body.nextAction,'stop');
    await savePreferences({enabled:false},dir);
    assert.equal((await request('/agent/mark',{})).status,423);
  }finally{await b.stop();m.close();if(prior===undefined)delete process.env.HANDOFFGLASS_RUNTIME_DIR;else process.env.HANDOFFGLASS_RUNTIME_DIR=prior;await rm(dir,{recursive:true,force:true});}
});
test('parked Codex binding neither blocks Stop nor publishes unrelated thinking',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'hg-hook-park-')),env={HANDOFFGLASS_RUNTIME_DIR:dir};
  const requests=[],request=async(_env,_state,event)=>{requests.push(event);return {};};
  const input={session_id:'chat',hook_event_name:'PostToolUse',tool_name:'mcp__handoffglass__session_start',tool_response:{structuredContent:{session:{id:owner,step:1,status:'awaiting_user',execution:'parked'},resumeToken:'a'.repeat(64)}}};
  try {
    await handleCodexHook(input,{env,request});
    for(const event of ['Stop','PreModelRequest'])assert.deepEqual(await handleCodexHook({session_id:'chat',hook_event_name:event},{env,request}),{});
    assert.deepEqual(requests,['bind']);
  }finally{await rm(dir,{recursive:true,force:true});}
});
