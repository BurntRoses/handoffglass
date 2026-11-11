import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NativeWorker,nativePermissionStatus,normalizeNativeOutput,validateTarget } from '../src/native/locator.mjs';

async function fixture(run,options={}) {
 const dir=await mkdtemp(join(tmpdir(),'hg-native-worker-'));
 const helper=join(dir,'helper.mjs');
 await writeFile(helper,`import {createInterface} from 'node:readline';
 for await(const line of createInterface({input:process.stdin})) {
   const q=JSON.parse(line);
   if(q.hang)continue;
   if(q.crash){process.exit(2);}
   if(q.invalid){process.stdout.write('broken\\n');continue;}
   if(q.event)process.stdout.write(JSON.stringify({event:'native_change',processId:42})+'\\n');
   if(q.delay)await new Promise(r=>setTimeout(r,q.delay));
   const response=Buffer.from(JSON.stringify({id:q.id,text:'继续'})+'\\n');
   process.stdout.write(response.subarray(0,response.length-5));
   await new Promise(r=>setTimeout(r,1));process.stdout.write(response.subarray(response.length-5));
 }`);
 const worker=new NativeWorker({command:process.execPath,args:[helper]},{timeoutMs:1000,...options});
 try{await run(worker);}finally{worker.close();await rm(dir,{recursive:true,force:true});}
}
test('native worker serializes concurrent queries in one process and preserves split UTF-8',async()=>fixture(async worker=>{
 const [a,b,c]=await Promise.all([worker.request({id:1,delay:10}),worker.request({id:2}),worker.request({id:3})]);
 assert.deepEqual([a,b,c].map(r=>r.id),[1,2,3]);assert.equal(b.text,'继续');assert.equal(worker.starts,1);
}));
test('native change notifications do not consume a query response',async()=>fixture(async worker=>{
 const events=[];worker.on('change',e=>events.push(e));
 assert.equal((await worker.request({id:4,event:true})).id,4);
 assert.deepEqual(events,[{processId:42}]);
}));
test('timed out, crashed or malformed workers restart without poisoning the next query',async()=>fixture(async worker=>{
 await assert.rejects(worker.request({hang:true}),e=>e.code==='native_timeout');
 // The short deadline tests an unresponsive request. Recovery also includes
 // cold Node startup on shared CI runners, so give those real processes time.
 worker.timeoutMs=5000;
 assert.equal((await worker.request({id:1})).id,1);
 await assert.rejects(worker.request({crash:true}),e=>e.code==='native_error');
 assert.equal((await worker.request({id:2})).id,2);
 await assert.rejects(worker.request({invalid:true}),e=>e.code==='native_error');
 assert.equal((await worker.request({id:3})).id,3);assert.equal(worker.starts,4);
},{timeoutMs:250}));
test('closing worker rejects queued work and never launches a replacement',async()=>fixture(async worker=>{
 const pending=worker.request({hang:true}),queued=worker.request({id:2});
 const checks=[assert.rejects(pending,e=>e.code==='helper_closed'),assert.rejects(queued,e=>e.code==='helper_closed')];
 await new Promise(r=>setTimeout(r,40));worker.close();await Promise.all(checks);
 assert.equal(worker.starts,1);await assert.rejects(worker.request({id:3}),e=>e.code==='helper_closed');
}));
test('permission probe only requests status and handles OS and app consent separately',async()=>{
 let seen;
 const env={HANDOFFGLASS_RUNTIME_DIR:'/nonexistent-hg-runtime'};
 const result=await nativePermissionStatus({platform:'darwin',env,runner:async(_,q)=>{seen=q;return {osPermission:'denied',nativeEvents:false};}});
 assert.deepEqual(seen,{mode:'status'});assert.equal(result.localConsent,false);assert.equal(result.osPermission,'denied');assert.equal(result.nextAction,'allow_in_app');
 const invalid=await nativePermissionStatus({platform:'darwin',env,runner:async()=>({})});
 assert.equal(invalid.osPermission,'unavailable');assert.equal(invalid.nextAction,'use_text_guidance');
});
test('native references are scoped and truncated searches never establish absence or uniqueness',()=>{
 const query={app:'Example',role:'button',name:'Continue',nativeRef:'11111111-1111-4111-8111-111111111111',scope:{processId:5,windowId:'9'}};
 const displays=[{id:'main',x:0,y:0,width:1000,height:800,scaleFactor:1}];
 const candidate={...query,bounds:{x:10,y:10,width:100,height:30},observedAt:Date.now(),enabled:true,visible:true,occluded:false};
 const result=normalizeNativeOutput({candidates:[candidate]},query,displays,'darwin');
 assert.equal(result.nativeRef,query.nativeRef);assert.deepEqual(result.scope,query.scope);
 assert.throws(()=>normalizeNativeOutput({candidates:[candidate],truncated:true},query,displays,'darwin'),e=>e.code==='inspection_incomplete');
 assert.throws(()=>normalizeNativeOutput({candidates:[],truncated:true},query,displays,'darwin'),e=>e.code==='inspection_incomplete');
 assert.throws(()=>normalizeNativeOutput({candidates:[]},query,displays,'darwin'),e=>e.code==='target_not_found');
 assert.throws(()=>normalizeNativeOutput({candidates:[{...candidate,nativeRef:'22222222-2222-4222-8222-222222222222'}]},query,displays,'darwin'),e=>e.code==='target_ref_expired');
 assert.throws(()=>validateTarget({...query,scope:{processId:-1,windowId:'9'}}),e=>e.code==='invalid_query');
});
