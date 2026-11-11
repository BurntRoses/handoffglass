import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {HandoffManager} from '../src/core.mjs';
import {LocalBridge} from '../src/bridge.mjs';
import {loadPreferences} from '../src/local/preferences.mjs';
import {getAccessibilityConsent} from '../src/native/preferences.mjs';

test('desktop patches preserve unrelated settings and cannot use Agent authority to grant consent',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'hg-desktop-settings-')),prior=process.env.HANDOFFGLASS_RUNTIME_DIR;
 process.env.HANDOFFGLASS_RUNTIME_DIR=dir;
 const m=new HandoffManager(),b=new LocalBridge(m,{headless:true});await b.start();
 const post=(patch,token=b.token,path='/desktop/preferences')=>fetch(`http://127.0.0.1:${b.port}${path}`,{
  method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json','x-handoffglass-owner':'11111111-1111-4111-8111-111111111111'},body:JSON.stringify(patch)
 });
 try{
  assert.equal((await post({accessibility:true},b.agentToken)).status,401);
  assert.equal(await getAccessibilityConsent(),false);
  assert.equal((await post({accessibility:true,unknown:'invalid'})).status,400);
  assert.equal(await getAccessibilityConsent(),false);
  const results=await Promise.all([post({enabled:false}),post({theme:'dark'}),post({continuous:false})]);
  assert.ok(results.every(r=>r.ok));
  assert.deepEqual(Object.fromEntries(Object.entries(await loadPreferences()).filter(([k])=>['enabled','theme','continuous'].includes(k))),{theme:'dark',enabled:false,continuous:false});
  await post({enabled:true,continuous:true,accessibility:true});
  const first=m.show({title:'Observed control',message:'Check the original app',continuous:true,x:10,y:10},'owner');
  m.setAnchorState(first.id,{status:'tracking',annotations:first.annotations});
  await post({accessibility:false});
  assert.equal(m.get(first.id).phase,'blocked');assert.equal(m.get(first.id).annotations.length,0);
  assert.equal(m.get(first.id).nextAction,'check_accessibility_permission');assert.equal(b.anchors.current,null);
  assert.equal((await loadPreferences()).theme,'dark');
  await Promise.all([post({enabled:false},b.agentToken,'/agent/integration-enabled'),post({density:'compact'})]);
  assert.equal((await loadPreferences()).enabled,false);assert.equal((await loadPreferences()).density,'compact');
  assert.equal(m.active(),null);
 }finally{await b.stop();m.close();if(prior===undefined)delete process.env.HANDOFFGLASS_RUNTIME_DIR;else process.env.HANDOFFGLASS_RUNTIME_DIR=prior;await rm(dir,{recursive:true,force:true});}
});
