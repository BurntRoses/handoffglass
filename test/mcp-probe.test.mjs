import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { checkLocalMcp, RpcLines, REQUIRED_TOOLS } from '../src/local/mcp-probe.mjs';
import { layoutDisplays } from '../src/local/display-layout.mjs';

function fakeProcess({ mode='success', collect=[] } = {}) {
  return (_command,_args,opts)=>{
    const child=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();
    child.kill=()=>{child.emit('exit',0);return true;};
    collect.push({args:_args,env:opts.env});
    let buffer='';
    child.stdin.on('data',data=>{
      buffer+=data.toString();const parts=buffer.split('\n');buffer=parts.pop();
      for(const part of parts){
        if(!part)continue;const req=JSON.parse(part);collect.push(req);
        if(mode==='timeout')continue;
        if(mode==='bad_response'){child.stdout.write('{not-json}\n');continue;}
        if(req.id===undefined)continue;
        let result;
        if(req.method==='initialize')result={protocolVersion:'2025-06-18',serverInfo:{name:'HandoffGlass',version:'test'},capabilities:{}};
        else if(req.method==='tools/list')result={tools:(mode==='missing_tools'?['screen_displays']:REQUIRED_TOOLS).map(name=>({name}))};
        else if(req.method==='tools/call')result={content:[{type:'text',text:'{"headless":true}'}]};
        if(result)setImmediate(()=>child.stdout.write(JSON.stringify({jsonrpc:'2.0',id:req.id,result})+'\n'));
      }
    });
    return child;
  };
}

test('stdio parser handles fragmented responses, notifications, missing response and process end',async()=>{
  const sent=[];const rpc=new RpcLines(line=>sent.push(JSON.parse(line)));
  const one=rpc.request('initialize',{capabilities:{}});
  assert.equal(sent[0].id,1);
  rpc.receive(Buffer.from('{"jsonrpc":"2.0","id":1,"res'));
  rpc.receive(Buffer.from('ult":{"ok":true}}\n'));
  assert.deepEqual(await one,{ok:true});
  const two=rpc.request('tools/list');
  rpc.close(new Error('process_exited'));
  await assert.rejects(two,/process_exited/);
});

test('isolated MCP selftest verifies tools without user sessions or host registration',async()=>{
  const collected=[];
  const result=await checkLocalMcp({command:'node',entry:'/test/mcp.mjs',spawnProcess:fakeProcess({collect:collected})});
  assert.deepEqual(result,{ok:true,code:'passed',phase:'complete',toolCount:REQUIRED_TOOLS.length,headless:true,hostVerified:false});
  assert.equal(collected[0].env.HANDOFFGLASS_HEADLESS,'1');
  assert.equal(collected[0].env.HANDOFFGLASS_ENABLE_ACCESSIBILITY,'0');
  assert.equal(collected[0].env.HANDOFFGLASS_EXTRAS,'0');
  assert.ok(collected[0].env.HANDOFFGLASS_RUNTIME_DIR.includes('hg-selftest-'));
  assert.deepEqual(collected.filter(x=>x.method?.startsWith('tools/')).map(x=>x.method),['tools/list','tools/call']);
  assert.ok(!collected.some(x=>x.method==='tools/call'&&x.params?.name!=='screen_displays'));
});

test('MCP selftest fails closed on timeout, incomplete tool list, and malformed stdout',async()=>{
  for(const [mode,code] of [['timeout','timeout'],['missing_tools','missing_tools'],['bad_response','protocol_mismatch']]){
    const result=await checkLocalMcp({command:'node',entry:'fake',timeoutMs:170,spawnProcess:fakeProcess({mode})});
    assert.equal(result.ok,false,mode);assert.equal(result.code,code,mode);assert.equal(result.hostVerified,false);
  }
  assert.equal((await checkLocalMcp({command:'',entry:''})).code,'launch_failed');
});

test('display diagram supports negative origins, mixed DPI and empty or invalid displays',()=>{
  const actual=layoutDisplays([
    {id:20,bounds:{x:-1920,y:0,width:1920,height:1080},scaleFactor:1.25},
    {id:10,bounds:{x:0,y:0,width:2560,height:1440},scaleFactor:2,primary:true}
  ]);
  assert.equal(actual.items.length,2);assert.equal(actual.origin.x,-1920);
  assert.equal(actual.items[0].dip.x,-1920);
  assert.ok(actual.items[1].x>actual.items[0].x);
  assert.equal(actual.items[1].scale,2);
  assert.equal(layoutDisplays([]).items.length,0);
  assert.equal(layoutDisplays([{id:1,bounds:{x:0,y:0,width:-1,height:20},scaleFactor:1}]).items.length,0);
  assert.throws(()=>layoutDisplays(Array.from({length:17},()=>null)),/Invalid/);
});

test('center connection diagnosis uses authenticated window and never accepts caller-provided commands',async()=>{
  const [entry,preload,ui,html]=await Promise.all([
    import('node:fs/promises').then(m=>m.readFile(new URL('../src/desktop/center.mjs',import.meta.url),'utf8')),
    import('node:fs/promises').then(m=>m.readFile(new URL('../src/desktop/center-preload.cjs',import.meta.url),'utf8')),
    import('node:fs/promises').then(m=>m.readFile(new URL('../src/desktop/center.js',import.meta.url),'utf8')),
    import('node:fs/promises').then(m=>m.readFile(new URL('../src/desktop/center.html',import.meta.url),'utf8'))
  ]);
  assert.match(entry,/if\(!authorized\(event\)\)/);
  assert.match(entry,/checkRunning/);
  assert.match(entry,/command:process\.execPath/);
  assert.doesNotMatch(preload,/test:.*\w+\s*=>\s*ipcRenderer\.invoke\('hg:center:test',\s*\w+/);
  assert.match(ui,/hgCenter\.test\(\)/);
  assert.match(ui,/createElementNS/);
  assert.match(html,/id="displayMap"/);
  assert.match(html,/id="testMcp"/);
});

test('shareable support report uses only explicit allowlisted runtime facts',async()=>{
  const { makeSupportReport }=await import('../src/local/support-report.mjs');
  const value=makeSupportReport({appVersion:'0.12.0',platform:'win32',localTest:{code:'timeout',token:'PRIVATE'},
    diagnostics:{broker:'running',desktop:'present',agentActivity:'recent',displays:2,title:'Private task',owner:'secret'}});
  assert.equal(value.mcpSelfTest,'timeout');assert.equal(value.displayCount,2);
  assert.equal(value.observation,'local_only_not_host_registration');
  assert.doesNotMatch(JSON.stringify(value),/Private|secret|token|owner/);
  assert.equal(makeSupportReport({localTest:{code:'arbitrary-secret'}}).mcpSelfTest,'not_run');
});
