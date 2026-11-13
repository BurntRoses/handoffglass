/** Codex evidence stays separate: files, enablement, tool discovery and actual calls. */
import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {homedir} from 'node:os';
import {spawn} from 'node:child_process';
import {parse} from 'smol-toml';
import {CODEX_PLUGIN,CODEX_MARKETPLACE} from '../codex-plugin.mjs';

const REQUIRED_TOOLS=['screen_mark','session_start','session_wait'];
const MODES=new Set(['auto','prompt','writes','approve']);
const PROBE_ERRORS=new Set(['codex_cli_unavailable','codex_probe_exited','codex_probe_response_too_large','codex_probe_invalid_response','codex_probe_request_failed','codex_probe_timeout']);
const stage=(status,code,evidence,extra={})=>({status,code,evidence,...extra});
const action=(code,message)=>({code,message});
const ownPolicy=config=>Object.fromEntries(['handoffglass',CODEX_PLUGIN].map(key=>{
  const server=config.plugins?.[key]?.mcp_servers?.handoffglass;
  const mode=server?.tools?.screen_mark?.approval_mode??server?.default_tools_approval_mode;
  return [key,MODES.has(mode)?mode:null];
}));

/** Raw host errors are classified, never copied into a UI or diagnostic report. */
export function classifyCodexCall(error) {
  const message=typeof error==='string'?error:error?.message||'';
  if(/requires approval|approval.*required/i.test(message))return 'approval_required';
  if(/disabled_by_user/.test(message))return 'disabled_by_user';
  if(/no_desktop/.test(message))return 'no_desktop';
  return 'tool_call_failed';
}

/**
 * hostEvidence is an observation supplied by the host, not an inferred readiness flag:
 * {source, installed?, enabled?, loaded?, toolNames?, approvalPolicy?, runtimeVersion?,
 *  lastCall?:{tool,ok,via:'model_tool_call'|'direct_rpc',code?,error?,approvalPolicy?}}
 * A direct app-server call proves transport only; it does not prove model authorization.
 */
export function assessCodexReadiness({local={},hostEvidence={}}={}) {
  const source=hostEvidence.source||'not_observed',call=hostEvidence.lastCall;
  const configuredPolicies=hostEvidence.configuredPolicies||ownPolicy(local.config||{});
  const stages={
    installed:stage('unknown','installation_unverified','not_observed'),
    enabled:stage('unknown','enablement_unverified','not_observed'),
    loaded:stage('unknown','tool_list_unobserved','not_observed'),
    tool_approval:stage('unknown','drawing_approval_unverified','not_observed',{configuredPolicies}),
    first_call:stage('unknown','tool_call_unobserved','not_observed')
  };
  if(hostEvidence.drawingAnnotations){
    const hints=hostEvidence.drawingAnnotations;
    stages.tool_approval.annotations=hints;
    stages.tool_approval.metadataWarning=hints.readOnlyHint!==true&&hints.destructiveHint!==false
      ?hints.destructiveHint===true?'destructive_hint_true':'destructive_hint_unspecified':null;
  }
  if(local.error)stages.installed=stage('blocked',local.error,'local_files');
  else if(local.cached&&local.registered)stages.installed=stage('passed','cached_registration_present','local_files');
  else if(local.receipt&&!local.cached)stages.installed=stage('blocked','cached_payload_missing','local_files');
  else if(local.registered===false&&!local.cached&&!local.receipt)stages.installed=stage('blocked','not_installed','local_files');
  if(typeof local.enabled==='boolean')stages.enabled=stage(local.enabled?'passed':'blocked',local.enabled?'enabled_in_user_config':'disabled_in_user_config','user_config');
  if(typeof hostEvidence.installed==='boolean')stages.installed=stage(hostEvidence.installed?'passed':'blocked',hostEvidence.installed?'host_reports_installed':'not_installed',source);
  if(typeof hostEvidence.enabled==='boolean')stages.enabled=stage(hostEvidence.enabled?'passed':'blocked',hostEvidence.enabled?'host_reports_enabled':'disabled_in_host',source);
  if(typeof hostEvidence.loaded==='boolean')stages.loaded=stage(hostEvidence.loaded?'passed':'blocked',hostEvidence.loaded?'host_connection_observed':'tools_not_loaded',source);
  if(Array.isArray(hostEvidence.toolNames)){
    const names=new Set(hostEvidence.toolNames),missingTools=REQUIRED_TOOLS.filter(name=>!names.has(name));
    stages.loaded=stage(missingTools.length?'blocked':'passed',missingTools.length?'required_tools_missing':'tools_discovered',source,{missingTools,toolCount:names.size});
  }
  if(hostEvidence.probeError)stages.loaded=stage('blocked',hostEvidence.probeError.code,source,{phase:hostEvidence.probeError.phase});
  const approvalPolicy=call?.approvalPolicy??hostEvidence.approvalPolicy??null;
  if(call&&typeof call.tool==='string'&&typeof call.ok==='boolean'){
    const code=call.ok?'host_call_succeeded':call.code||classifyCodexCall(call.error);
    stages.first_call=stage(call.ok?'passed':'blocked',code,source,{tool:call.tool,via:call.via||'unspecified'});
    if(call.tool==='screen_mark'){
      if(call.ok&&call.via==='model_tool_call')Object.assign(stages.tool_approval,stage('passed','drawing_call_authorized',source));
      else if(!call.ok&&code==='approval_required')Object.assign(stages.tool_approval,stage('blocked',approvalPolicy==='never'?'approval_unavailable_in_never':'approval_required',source));
      // Only an observed application response, not a transport error, establishes execution.
      else if(call.via==='model_tool_call'&&call.toolExecuted===true)Object.assign(stages.tool_approval,stage('passed','drawing_call_authorized',source));
    }
  }
  if(local.duplicateRegistration)stages.enabled=stage('blocked','duplicate_registration','user_config');
  let nextAction;
  if(stages.installed.status==='blocked')nextAction=action(stages.installed.code==='not_installed'?'install_plugin':'check_installation','检查 HandoffGlass 插件安装；保留 Codex 的其他插件和设置。');
  else if(stages.enabled.status==='blocked')nextAction=action(stages.enabled.code==='duplicate_registration'?'remove_duplicate_connection':'enable_plugin',stages.enabled.code==='duplicate_registration'?'当前同时配置了插件和独立 MCP。保留一个 HandoffGlass 接入入口。':'在 Codex 插件设置中启用 HandoffGlass。');
  else if(stages.tool_approval.status==='blocked')nextAction=action('interactive_approval_required',approvalPolicy==='never'
    ?'当前 Codex 会话禁止弹出工具确认。请在可交互的 Codex 对话中发起绘制，并在 Codex 的确认框中允许本次调用。HandoffGlass 无法代为批准。'
    :'请在 Codex 的工具确认框中允许本次绘制，或取消这次请求。');
  else if(stages.loaded.status!=='passed')nextAction=action('check_host_tools','让当前 Codex 对话检查 HandoffGlass 工具是否可见。安装文件或本地自检不能证明当前对话已加载。');
  else if(stages.first_call.status==='blocked')nextAction=action(stages.first_call.code,'处理此次工具返回的问题后，再验证一次实际调用。');
  else if(stages.installed.status!=='passed'||stages.enabled.status!=='passed')nextAction=action('check_installation','请检查 Codex 插件设置中的 HandoffGlass 安装与启用状态。');
  else if(stages.tool_approval.status!=='passed')nextAction=action('verify_drawing_call','在 Codex 中说“画一个圆”验证首次绘制；出现工具确认时由用户决定。');
  else nextAction=action('ready','Codex 已完成工具发现和实际绘制调用验证。');
  const ready=Object.values(stages).every(s=>s.status==='passed');
  return {schemaVersion:1,host:'codex',pluginId:CODEX_PLUGIN,ready,stages,nextAction,
    approvalPolicy,runtimeVersion:hostEvidence.runtimeVersion||null,
    probeScope:source,modelCalls:0,configChanged:false};
}

async function readOptional(path){
  try{
    const text=await readFile(path,'utf8');
    if(text.length>1024*1024)throw Error('local_metadata_too_large');
    return text;
  }catch(error){if(error.code==='ENOENT')return null;throw error;}
}

async function localEvidence(codexHome){
  try{
    const raw=await readOptional(join(codexHome,'config.toml')),config=raw?parse(raw):{};
    const entry=config.plugins?.[CODEX_PLUGIN];
    const receiptRaw=await readOptional(join(codexHome,'handoffglass-plugin-install.json'));
    const receipt=receiptRaw?JSON.parse(receiptRaw):null;
    const cache=join(codexHome,'plugins','cache',CODEX_MARKETPLACE,'handoffglass');
    let versions=[];
    try{versions=await readdir(cache,{withFileTypes:true});}catch(error){if(error.code!=='ENOENT')throw error;}
    let cached=false;
    for(const version of versions.filter(e=>e.isDirectory()).slice(0,64)){
      const folder=join(cache,version.name);
      const manifestRaw=await readOptional(join(folder,'.codex-plugin','plugin.json'));
      if(!manifestRaw)continue;
      const manifest=JSON.parse(manifestRaw);
      const mcpRaw=await readOptional(join(folder,'.mcp.json'));
      if(manifest.name==='handoffglass'&&mcpRaw&&JSON.parse(mcpRaw).mcpServers?.handoffglass){cached=true;break;}
    }
    return {config,registered:!!entry,cached,enabled:entry?entry.enabled!==false:undefined,
      receipt:receipt?.version===1&&receipt?.plugin===CODEX_PLUGIN,
      duplicateRegistration:!!entry&&entry.enabled!==false&&!!config.mcp_servers?.handoffglass&&config.mcp_servers.handoffglass.enabled!==false};
  }catch(error){return {error:error instanceof SyntaxError||error.name==='TomlError'?'invalid_local_metadata':'local_metadata_unreadable'};}
}

/** Default is a quick file read. A new native host is started only on explicit probeHost. */
export async function checkCodexReadiness({codexHome,userHome,cwd=process.cwd(),
  codexCommand=process.env.HANDOFFGLASS_CODEX_COMMAND||'codex',probeHost=false,hostEvidence,
  timeoutMs=20000,spawnProcess=spawn}={}) {
  codexHome||=process.env.CODEX_HOME||join(userHome||homedir(),'.codex');
  const local=await localEvidence(codexHome);
  const observed=probeHost?await probeCodexHost({codexHome,cwd,codexCommand,timeoutMs,spawnProcess}):hostEvidence||{};
  return assessCodexReadiness({local,hostEvidence:observed});
}

/** No turn/start, tool execution, hook trust or config writes. A fresh probe is not the current chat. */
export async function probeCodexHost({codexHome=process.env.CODEX_HOME||join(homedir(),'.codex'),cwd=process.cwd(),
  codexCommand=process.env.HANDOFFGLASS_CODEX_COMMAND||'codex',timeoutMs=20000,spawnProcess=spawn}={}) {
  if(!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>60000)throw new RangeError('Invalid Codex probe timeout');
  const evidence={source:'app_server_probe'};
  let child,timer,buffer='',sequence=0,phase='launch';
  const pending=new Map();
  const fail=code=>{for(const p of pending.values())p.reject(Error(code));pending.clear();};
  try{
    child=spawnProcess(codexCommand,['--no-daemon','app-server'],{env:{...process.env,CODEX_HOME:codexHome},stdio:['pipe','pipe','ignore'],windowsHide:true});
    child.on('error',()=>fail('codex_cli_unavailable'));
    child.on('exit',()=>fail('codex_probe_exited'));
    child.stdin.on('error',()=>fail('codex_probe_exited'));
    child.stdout.on('data',chunk=>{
      buffer+=chunk.toString('utf8');
      if(buffer.length>2*1024*1024){fail('codex_probe_response_too_large');child.kill();return;}
      let index;
      while((index=buffer.indexOf('\n'))>=0){
        const line=buffer.slice(0,index).trim();buffer=buffer.slice(index+1);
        if(!line)continue;
        let message;
        try{message=JSON.parse(line);}catch{fail('codex_probe_invalid_response');continue;}
        // A probe never answers host approval or authorization requests affirmatively.
        if(message.method&&message.id!==undefined){child.stdin.write(JSON.stringify({id:message.id,error:{code:-32601,message:'Readiness probe does not perform interactive actions'}})+'\n');continue;}
        const request=pending.get(message.id);
        if(!request)continue;
        pending.delete(message.id);
        message.error?request.reject(Error('codex_probe_request_failed')):request.resolve(message.result);
      }
    });
    const request=(method,params)=>new Promise((resolve,reject)=>{
      const id=++sequence;pending.set(id,{resolve,reject});
      child.stdin.write(JSON.stringify({id,method,params})+'\n',error=>{if(error){pending.delete(id);reject(Error('codex_probe_exited'));}});
    });
    const transaction=(async()=>{
      phase='initialize';
      const initialized=await request('initialize',{clientInfo:{name:'handoffglass_readiness',version:'1.0.0'},capabilities:{experimentalApi:true}});
      evidence.runtimeVersion=initialized?.userAgent?.match(/(?:Desktop|CLI)\/([^ ]+)/)?.[1]||null;
      child.stdin.write(JSON.stringify({method:'initialized'})+'\n');
      phase='configuration';
      const effective=await request('config/read',{cwd,includeLayers:false});
      const entry=effective?.config?.plugins?.[CODEX_PLUGIN];
      evidence.configuredPolicies=ownPolicy(effective?.config||{});
      if(entry)evidence.enabled=entry.enabled!==false;
      phase='thread';
      const started=await request('thread/start',{cwd,ephemeral:true,sandbox:'read-only',approvalPolicy:'never'});
      evidence.approvalPolicy=started?.approvalPolicy??'never';
      if(!started?.thread?.id)throw Error('codex_probe_invalid_response');
      if(started.disabledPluginIds?.includes(CODEX_PLUGIN))evidence.enabled=false;
      phase='tools';
      let cursor=null,server;
      do{
        const status=await request('mcpServerStatus/list',{threadId:started.thread.id,cursor,limit:100,detail:'toolsAndAuthOnly'});
        if(!Array.isArray(status?.data))throw Error('codex_probe_invalid_response');
        server=status.data.find(s=>s.pluginId===CODEX_PLUGIN)||server;
        cursor=status.nextCursor||null;
      }while(cursor&&!server);
      evidence.loaded=!!server&&!server.toolsError;
      if(server){
        evidence.toolNames=Object.keys(server.tools||{});evidence.installed=true;
        const hints=server.tools?.screen_mark?.annotations||{};
        evidence.drawingAnnotations=Object.fromEntries(['readOnlyHint','destructiveHint','openWorldHint','idempotentHint'].map(key=>[key,typeof hints[key]==='boolean'?hints[key]:null]));
      }
      return evidence;
    })();
    return await Promise.race([transaction,new Promise((_,reject)=>{timer=setTimeout(()=>{fail('codex_probe_timeout');reject(Error('codex_probe_timeout'));},timeoutMs);})]);
  }catch(error){return {...evidence,probeError:{code:PROBE_ERRORS.has(error.message)?error.message:'codex_probe_failed',phase}};}
  finally{
    clearTimeout(timer);fail('codex_probe_closed');
    if(child){child.stdin.on('error',()=>{});child.stdin.end();child.kill();}
  }
}
