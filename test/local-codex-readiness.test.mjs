import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough,Writable} from 'node:stream';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {assessCodexReadiness,checkCodexReadiness,probeCodexHost,classifyCodexCall} from '../src/local/codex-readiness.mjs';
import {toolCatalog} from '../src/mcp.mjs';

const pluginId='handoffglass@handoffglass-local';
const names=['screen_mark','session_start','session_wait'];
const local={registered:true,cached:true,enabled:true,config:{plugins:{[pluginId]:{mcp_servers:{handoffglass:{tools:{screen_mark:{approval_mode:'approve'}}}}}}}};
const discovered={source:'current_host',loaded:true,toolNames:names};

test('installation, enablement and configured approve never imply loading or authorization',()=>{
  const result=assessCodexReadiness({local});
  assert.equal(result.stages.installed.status,'passed');
  assert.equal(result.stages.enabled.status,'passed');
  for(const key of ['loaded','tool_approval','first_call'])assert.equal(result.stages[key].status,'unknown');
  assert.equal(result.stages.tool_approval.configuredPolicies[pluginId],'approve');
  assert.equal(result.ready,false);
});

test('actual never-policy refusal wins over a configured single-tool approve',()=>{
  const result=assessCodexReadiness({local,hostEvidence:{...discovered,approvalPolicy:'never',lastCall:{tool:'screen_mark',ok:false,via:'model_tool_call',error:'MCP tool call requires approval, but approval policy is never'}}});
  assert.equal(result.stages.loaded.status,'passed');
  assert.equal(result.stages.tool_approval.code,'approval_unavailable_in_never');
  assert.equal(result.stages.first_call.code,'approval_required');
  assert.equal(result.nextAction.code,'interactive_approval_required');
  assert.match(result.nextAction.message,/可交互.*确认/);
  assert.doesNotMatch(JSON.stringify(result),/bypass|danger-full-access|信任所有/);
});

test('read-tool and direct-RPC success do not prove model drawing approval',()=>{
  for(const lastCall of [{tool:'screen_displays',ok:true,via:'model_tool_call'},{tool:'screen_mark',ok:true,via:'direct_rpc'}]){
    const result=assessCodexReadiness({local,hostEvidence:{...discovered,lastCall}});
    assert.equal(result.stages.first_call.status,'passed');
    assert.equal(result.stages.tool_approval.status,'unknown');
    assert.equal(result.ready,false);
  }
  const live=assessCodexReadiness({local,hostEvidence:{source:'current_host',loaded:true,lastCall:{tool:'capability_manifest',ok:true,via:'model_tool_call'}}});
  assert.equal(live.stages.loaded.status,'passed');
  assert.equal(live.stages.tool_approval.status,'unknown');
});

test('a successful model screen_mark call and a discovered catalog complete the five stages',()=>{
  const result=assessCodexReadiness({local,hostEvidence:{...discovered,lastCall:{tool:'screen_mark',ok:true,via:'model_tool_call'}}});
  assert.equal(result.ready,true);
  assert.equal(result.nextAction.code,'ready');
  assert.ok(Object.values(result.stages).every(stage=>stage.status==='passed'));
});

test('application error proves authorization, but first drawing still fails',()=>{
  const result=assessCodexReadiness({local,hostEvidence:{...discovered,lastCall:{tool:'screen_mark',ok:false,via:'model_tool_call',code:'no_desktop',toolExecuted:true}}});
  assert.equal(result.stages.tool_approval.status,'passed');
  assert.equal(result.stages.first_call.status,'blocked');
  assert.equal(result.nextAction.code,'no_desktop');
  const transport=assessCodexReadiness({local,hostEvidence:{...discovered,lastCall:{tool:'screen_mark',ok:false,via:'model_tool_call',code:'tool_call_failed'}}});
  assert.equal(transport.stages.tool_approval.status,'unknown');
});

test('incomplete catalogs, explicit host disablement and duplicate registrations remain blocked',()=>{
  const missing=assessCodexReadiness({local,hostEvidence:{...discovered,toolNames:['screen_displays']}});
  assert.equal(missing.stages.loaded.code,'required_tools_missing');
  assert.ok(missing.stages.loaded.missingTools.includes('screen_mark'));
  const disabled=assessCodexReadiness({local,hostEvidence:{...discovered,enabled:false}});
  assert.equal(disabled.nextAction.code,'enable_plugin');
  const duplicate=assessCodexReadiness({local:{...local,duplicateRegistration:true}});
  assert.equal(duplicate.nextAction.code,'remove_duplicate_connection');
});

test('default check reads only local metadata and never starts another Codex process',async()=>{
  const home=await mkdtemp(join(tmpdir(),'hg-codex-ready-'));
  try{
    const config='api_secret="do-not-print-this"\n[plugins."handoffglass@handoffglass-local"]\nenabled=true\n';
    await writeFile(join(home,'config.toml'),config);
    const cache=join(home,'plugins','cache','handoffglass-local','handoffglass','0.22.1');
    await mkdir(join(cache,'.codex-plugin'),{recursive:true});
    await writeFile(join(cache,'.codex-plugin','plugin.json'),JSON.stringify({name:'handoffglass',version:'0.22.1'}));
    await writeFile(join(cache,'.mcp.json'),JSON.stringify({mcpServers:{handoffglass:{command:'node',env:{SECRET:'never-output'}}}}));
    const result=await checkCodexReadiness({codexHome:home,spawnProcess:()=>{throw Error('must not spawn');}});
    assert.equal(result.stages.installed.status,'passed');
    assert.equal(result.stages.loaded.status,'unknown');
    assert.equal(result.modelCalls,0);assert.equal(result.configChanged,false);
    assert.doesNotMatch(JSON.stringify(result),/do-not-print|never-output|hg-codex-ready/);
    assert.equal(await readFile(join(home,'config.toml'),'utf8'),config);
    await writeFile(join(home,'config.toml'),'[broken');
    assert.equal((await checkCodexReadiness({codexHome:home})).stages.installed.status,'blocked');
  }finally{await rm(home,{recursive:true,force:true});}
});

function fakeHost({mode='normal',calls=[]}={}){
  return (command,args,options)=>{
    const child=new EventEmitter();child.stdout=new PassThrough();child.killed=false;
    calls.push({command,args,options});
    child.kill=()=>{child.killed=true;child.emit('exit',0);};
    child.stdin=new Writable({write(chunk,encoding,done){
      const message=JSON.parse(chunk.toString());calls.push(message);
      if(mode==='timeout'){done();return;}
      let result;
      switch(message.method){
        case 'initialize':result={userAgent:'Codex Desktop/0.167.0-alpha.4.1 (Mac OS; arm64)'};break;
        case 'config/read':result={config:{plugins:{[pluginId]:{enabled:true}}}};break;
        case 'thread/start':result={thread:{id:'ephemeral-probe'},approvalPolicy:'never'};break;
        case 'mcpServerStatus/list':result={data:[{name:'plugin_handoffglass_handoffglass',pluginId,tools:Object.fromEntries(names.map(name=>[name,{name}]))}],nextCursor:null};break;
      }
      if(message.id!==undefined)queueMicrotask(()=>child.stdout.write(JSON.stringify({id:message.id,result})+'\n'));
      done();
    }});
    return child;
  };
}

test('explicit native probe discovers tools without calling a model, a tool or a config mutation',async()=>{
  const calls=[];
  const result=await probeCodexHost({codexHome:'/test/codex',cwd:'/test/project',spawnProcess:fakeHost({calls})});
  assert.equal(result.loaded,true);assert.equal(result.installed,true);
  assert.deepEqual(result.toolNames,names);
  assert.equal(result.source,'app_server_probe');
  assert.equal(result.runtimeVersion,'0.167.0-alpha.4.1');
  assert.deepEqual(calls[0].args,['--no-daemon','app-server']);
  const requests=calls.filter(call=>call.method);
  assert.deepEqual(requests.map(call=>call.method),['initialize','initialized','config/read','thread/start','mcpServerStatus/list']);
  assert.deepEqual(requests.find(call=>call.method==='thread/start').params,{cwd:'/test/project',ephemeral:true,sandbox:'read-only',approvalPolicy:'never'});
  assert.doesNotMatch(JSON.stringify(requests),/turn\/start|tool\/call|config\/.*write|hooks\/.*trust/);
  const assessment=assessCodexReadiness({local,hostEvidence:result});
  assert.equal(assessment.stages.loaded.status,'passed');
  assert.equal(assessment.stages.first_call.status,'unknown');
  assert.equal(assessment.stages.tool_approval.status,'unknown');
});

test('probe failures are bounded and classified without exposing error text',async()=>{
  const timeout=await probeCodexHost({timeoutMs:100,spawnProcess:fakeHost({mode:'timeout'})});
  assert.equal(timeout.probeError.code,'codex_probe_timeout');
  const result=assessCodexReadiness({local,hostEvidence:timeout});
  assert.equal(result.stages.loaded.status,'blocked');
  assert.equal(result.stages.loaded.code,'codex_probe_timeout');
  assert.equal(classifyCodexCall('secret path: MCP tool call requires approval, but approval policy is never'),'approval_required');
  assert.equal(classifyCodexCall('secret path: unexpected error'),'tool_call_failed');
  const failure=await probeCodexHost({spawnProcess:()=>{throw Error('/private/secret/command');}});
  assert.equal(failure.probeError.code,'codex_probe_failed');
  assert.doesNotMatch(JSON.stringify(failure),/private|secret/);
});

test('the probe surfaces destructive hints independently of configured tool approval',()=>{
  const result=assessCodexReadiness({local,hostEvidence:{...discovered,drawingAnnotations:{readOnlyHint:false,destructiveHint:null,openWorldHint:null,idempotentHint:null}}});
  assert.equal(result.stages.tool_approval.metadataWarning,'destructive_hint_unspecified');
  assert.equal(result.stages.tool_approval.status,'unknown');
});

test('drawing metadata describes a reversible local write; uninstall stays destructive',()=>{
  const tools=toolCatalog({});
  assert.deepEqual(tools.get('screen_mark').annotations,{readOnlyHint:false,destructiveHint:false,openWorldHint:false,idempotentHint:false});
  assert.equal(tools.get('integration_cleanup').annotations.destructiveHint,true);
  assert.equal(tools.get('integration_uninstall').annotations.destructiveHint,true);
  for(const name of ['session_start','session_present','session_update','review_changes','session_verify','session_resume','session_control','session_stop']){
    assert.equal(tools.get(name).annotations.readOnlyHint,false,name);
    assert.equal(tools.get(name).annotations.destructiveHint,false,name);
    assert.equal(tools.get(name).annotations.openWorldHint,false,name);
  }
});
