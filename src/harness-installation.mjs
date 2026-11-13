/** Owned local integrations; host trust, approval policy and unrelated settings stay with the host. */
import {execFile} from 'node:child_process';
import {promisify,isDeepStrictEqual} from 'node:util';
import {homedir} from 'node:os';
import {join,resolve,isAbsolute,relative,sep} from 'node:path';
import {access,rmdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {planHarnessPlugin,planHarnessRemoval} from './harness-plugin.mjs';
import {readManagedFile,applyFileTransaction,digest,removeEmptyParents,deferManagedRemovals} from './managed-files.mjs';
import {editJsoncMember,editJsoncArrayReference,jsoncValue} from './local/jsonc-edit.mjs';
import {runtimeDir} from './runtime.mjs';
import {pluginRuntimeMode} from './plugin-snapshot.mjs';
export const HARNESS_HOSTS=Object.freeze(['claude-code','deepseek','opencode','cursor','trae']);
const run=promisify(execFile),marketplace='handoffglass-local',plugin='handoffglass@'+marketplace;
const activeMutations=new Set();
const json=value=>JSON.stringify(value,null,2)+'\n';
const normalize=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
const equal=(a,b)=>isDeepStrictEqual(normalize(a),normalize(b));
const exists=async path=>{try{await access(path);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}};
function validateHost(host){if(!HARNESS_HOSTS.includes(host))throw TypeError('Unsupported local harness');}
function basePaths(host,options){
 validateHost(host);const home=resolve(options.home||options.userHome||homedir()),dir=resolve(options.dir||runtimeDir());
 const state=join(dir,'harnesses',host),recordPath=join(state,'installation.json');
 return {home,dir,state,recordPath,output:resolve(options.output||join(state,host==='claude-code'?'marketplace/plugins/handoffglass':'plugin'))};
}
async function recordAt(host,options={}){
 const paths=basePaths(host,options),raw=await readManagedFile(paths.recordPath),record=raw?JSON.parse(raw):null;
 if(record&&(record.schemaVersion!==1||record.host!==host||!isAbsolute(record.output)||!isAbsolute(record.configPath||record.output)||typeof record.enabled!=='boolean'||!/^[a-f\d-]{36}$/.test(record.installationId||'')))throw Error('Invalid harness installation record');
 if(record?.output&&options.output&&resolve(options.output)!==record.output)throw Error('Remove the recorded integration before changing its location');
 return {...paths,output:record?.output||paths.output,raw,record};
}
async function targetPath(host,options,paths){
 if(paths.record?.configPath){if(options.configPath&&resolve(options.configPath)!==paths.record.configPath)throw Error('Remove the recorded integration before changing configuration files');return paths.record.configPath;}
 if(options.configPath)return resolve(options.configPath);
 if(host==='cursor')return join(paths.home,'.cursor','mcp.json');
 if(host==='opencode'){
  const folder=join(options.configHome||join(paths.home,'.config'),'opencode');
  return await exists(join(folder,'opencode.jsonc'))?join(folder,'opencode.jsonc'):join(folder,'opencode.json');
 }
 if(host==='trae')return options.workspace?join(resolve(options.workspace),'.trae','mcp.json'):null;
 return null;
}
function nextAction(host){return host==='claude-code'?'reload_claude_plugins':host==='deepseek'?'launch_deepseek_with_patch':host==='trae'?'enable_project_mcp_and_reload':'reload_host';}
const common=(host,paths)=>({host,installationId:paths.record?.installationId??null,installed:!!paths.record,managed:!!paths.record,configured:!!paths.record,enabled:paths.record?.enabled??false,runtimeMode:paths.record?.runtimeMode??null,hostState:'not_observed',endToEnd:'unverified',reloadRequired:false,items:[],retained:[],scope:'managed_host_integration',cleanupAvailable:!!paths.record,hostAction:nextAction(host)});
async function configEvidence(host,paths){
 const record=paths.record;if(!record)return false;
 if(host==='claude-code'){
  const raw=await readManagedFile(join(record.claudeHome,'settings.json'));if(!raw)return false;
  return jsoncValue(raw,['enabledPlugins',plugin])===record.enabled||record.referenceRemoved&&jsoncValue(raw,['enabledPlugins',plugin])===undefined;
 }
 if(host==='deepseek'){
  const raw=await readManagedFile(join(record.output,'cordis.yml'));return raw!==null&&digest(raw)===record.patchHash;
 }
 const raw=await readManagedFile(record.configPath);if(raw===null)return !record.enabled;
 if(host==='opencode')return (jsoncValue(raw,['plugins'])??[]).includes(record.output)===record.enabled;
 return equal(jsoncValue(raw,['mcpServers','handoffglass']),record.enabled?record.entry:undefined);
}
export async function harnessStatus(host,options={}){
 const paths=await recordAt(host,options),result=common(host,paths);let configurationMatches=await configEvidence(host,paths);
 if(configurationMatches){
  const connectionRaw=await readManagedFile(join(paths.output,'connection.json')),receiptRaw=await readManagedFile(join(paths.output,'handoffglass-bundle.json'));
  const receipt=receiptRaw?JSON.parse(receiptRaw):null;
  configurationMatches=!!connectionRaw&&digest(connectionRaw)===receipt?.files?.['connection.json']&&JSON.parse(connectionRaw).env?.HANDOFFGLASS_CONNECTION_ID===paths.record.installationId;
 }
 return {...result,state:paths.record?configurationMatches?'installed':'modified':'not_installed',configurationMatches,
  cleanupAvailable:!!paths.record,output:paths.output,configPath:paths.record?.configPath??null,
  nextAction:paths.record?nextAction(host):'install',...(host==='deepseek'&&paths.record?{launchCommand:paths.record.launchCommand,launchEnv:launchEnvironment(paths.record)}:{})};
}
function entryFor(host,paths,options,installationId){
 const entry={command:options.command||process.execPath,args:[join(paths.output,'runtime/src/mcp.mjs')],env:{...(options.configOptions?.envOverrides||{}),...(options.envOverrides||{}),HANDOFFGLASS_HOST_ID:host,HANDOFFGLASS_CONNECTION_ID:installationId,HANDOFFGLASS_OUTPUT:'compact',HANDOFFGLASS_TOOL_PROFILE:'host',HANDOFFGLASS_RUNTIME_DIR:paths.dir,HANDOFFGLASS_RUNTIME_MODE:options.runtimeMode,
  ...(options.desktopRuntime!==false?{HANDOFFGLASS_EMBEDDED_RENDERER:'1'}:{})}};
 if(options.desktopRuntime===false)delete entry.env.HANDOFFGLASS_EMBEDDED_RENDERER;
 return entry;
}
async function editConfig(host,paths,options,record,enabled){
 const path=await targetPath(host,options,paths);if(!path)throw Object.assign(Error('Choose the TRAE MCP configuration file or project folder'),{code:'configuration_path_required',nextAction:'open_trae_mcp_config'});
 const prior=await readManagedFile(path),source=prior??'{}\n';let next;
 if(host==='opencode'){
  const refs=jsoncValue(source,['plugins']);if(refs!==undefined&&!Array.isArray(refs))throw Error('OpenCode plugins must be an array');
  const has=(refs??[]).includes(paths.output);
  if(!paths.record&&has)throw Error('This plugin reference is not recorded as HandoffGlass-owned');
  if(paths.record&&has!==paths.record.enabled)throw Error('Host plugin reference changed; preserve it and refresh the connection');
  next=editJsoncArrayReference(source,'plugins',paths.output,enabled);
 }else{
  const current=jsoncValue(source,['mcpServers','handoffglass']);
  if(paths.record?!equal(current,paths.record.enabled?paths.record.entry:undefined):current!==undefined)throw Error('HandoffGlass MCP entry was changed or is unmanaged; no automatic overwrite');
  next=editJsoncMember(source,['mcpServers','handoffglass'],record.entry,{remove:!enabled});
 }
 return {path,prior,next,kind:'host_config'};
}
async function claude(args,options,record){
 const command=options.claudeCommand||record?.claudeCommand||'claude',env={...process.env,CLAUDE_CONFIG_DIR:record?.claudeHome||options.claudeHome||join(options.home||options.userHome||homedir(),'.claude')};
 let result,failure;
 try{result=options.runCommand?await options.runCommand(command,['plugin',...args],{env}):await run(command,['plugin',...args],{env,timeout:45000,maxBuffer:1024*1024});}
 catch(error){failure=error;result={stdout:error.stdout||''};}
 const stdout=typeof result==='string'?result:result.stdout||'';let parsed;
 for(const line of stdout.trim().split('\n').reverse()){try{parsed=JSON.parse(line);break;}catch{/* CLI may print progress before its JSON result. */}}
 if(parsed?.failureCode==='already_in_goal_state'&&['enable','disable'].includes(args[0]))return parsed;
 if(failure)throw failure;
 if(parsed?.outcome==='failed')throw Object.assign(Error(parsed.message||'Claude Code plugin command failed'),{code:parsed.failureCode||'host_command_failed'});
 return parsed;
}
function patchContents(output,enabled){return '- insert:\n    - id: handoffglass\n      name: '+JSON.stringify(join(output,'src/plugin.ts'))+'\n      disabled: '+(!enabled)+'\n';}
function launchEnvironment(record){return record.entry?.env?.ELECTRON_RUN_AS_NODE==='1'?{ELECTRON_RUN_AS_NODE:'1'}:{};}
function launchContents(record){return `// HandoffGlass-owned launcher. Uses the official per-run Cordis patch.\nimport {spawn} from 'node:child_process';\nconst env={...process.env};\nfor(const key of Object.keys(env))if(key.toLowerCase()==='electron_run_as_node')delete env[key];\nconst child=spawn(${JSON.stringify(record.harnessCommand)},${JSON.stringify([...record.harnessArgs,'--patch',join(record.output,'cordis.yml')])},{stdio:'inherit',shell:false,env${record.workspace?',cwd:'+JSON.stringify(record.workspace):''}});\nchild.on('error',error=>{console.error(error.message);process.exitCode=1;});\nchild.on('exit',code=>{process.exitCode=code??1;});\n`;}
async function installHarnessInternal(host,{confirm=false,...options}={}){
 const mode=await pluginRuntimeMode(options.root,options.desktopRuntime??true);
 options={...options,desktopRuntime:mode.desktop,runtimeMode:mode.runtimeMode};
 const paths=await recordAt(host,options),installationId=paths.record?.installationId||randomUUID(),enabled=paths.record?.enabled??true;
 const entry=entryFor(host,paths,options,installationId),record={schemaVersion:1,host,installationId,output:paths.output,enabled,entry,
  ...(paths.record||{}),updatedAt:new Date().toISOString()};
 // Retain the stable identity, but refresh this release's executable and environment.
 record.entry=entry;record.runtimeMode=mode.runtimeMode;
 const config=!['claude-code','deepseek'].includes(host)?await editConfig(host,paths,options,record,enabled):null;
 if(config){record.configPath=config.path;if(!paths.record)record.parentCreated=jsoncValue(config.prior??'{}',host==='opencode'?['plugins']:['mcpServers'])===undefined;}
 if(host==='claude-code'){
  record.claudeHome=resolve(options.claudeHome||paths.record?.claudeHome||join(paths.home,'.claude'));
  record.claudeCommand=options.claudeCommand||paths.record?.claudeCommand||'claude';record.marketplaceRoot=join(paths.state,'marketplace');
  const source=relative(record.marketplaceRoot,paths.output);if(source.startsWith('..')||isAbsolute(source)||!source)throw Error('Claude plugin output must be inside its owned marketplace directory');record.pluginSource='./'+source.split(sep).join('/');
 }
 if(host==='deepseek'){
  record.harnessCommand=options.harnessCommand||paths.record?.harnessCommand||'dsh';record.harnessArgs=options.harnessArgs||paths.record?.harnessArgs||['web'];record.workspace=options.workspace?resolve(options.workspace):paths.record?.workspace;
  record.patchHash=digest(patchContents(paths.output,enabled));record.launchCommand=[options.command||process.execPath,join(paths.state,'launch.mjs')];record.launchEnv=launchEnvironment(record);
 }
 const result={...common(host,paths),confirmationRequired:!confirm,applied:false,changed:true,output:paths.output,
  items:[{path:paths.output,kind:'runtime_bundle',action:paths.record?'update':'install'},...(config?[{path:config.path,kind:'host_config',action:'merge'}]:[]),...(host==='claude-code'?[{kind:'native_plugin',path:plugin,action:paths.record?'update':'install'}]:[]),{path:paths.recordPath,kind:'installation_record',action:'write'}],nextAction:nextAction(host)};
 if(!confirm)return result;
 let ownedClaude=false;
 if(host==='claude-code'){
  const installed=await claude(['list','--json'],options,record),markets=await claude(['marketplace','list','--json'],options,record);
  if(!Array.isArray(installed)||!Array.isArray(markets))throw Error('Claude Code did not return its installed plugin and marketplace lists');
  ownedClaude=installed.some(item=>item.id===plugin&&item.scope==='user');
  const existing=markets.find(item=>item.name===marketplace);
  if(!paths.record&&(ownedClaude||existing))throw Error('An unrecorded HandoffGlass Claude plugin or marketplace exists; leave it unchanged');
  if(existing&&(!existing.path||resolve(existing.path)!==record.marketplaceRoot))throw Error('The Claude marketplace source changed; preserve the user configuration');
 }
 const bundle=await planHarnessPlugin({host,output:paths.output,root:options.root,command:entry.command,desktopRuntime:options.desktopRuntime??true,envOverrides:entry.env,lifecycle:options.lifecycle||paths.record?.lifecycle||'light'});
 record.lifecycle=options.lifecycle||paths.record?.lifecycle||'light';
 const changes=[...bundle.changes];record.version=bundle.version;
 if(config&&config.prior!==config.next)changes.push(config);
 if(config&&config.prior!==null&&!paths.record){
  const backup=join(paths.state,'configuration-before.jsonc'),prior=await readManagedFile(backup);if(prior!==null)throw Error('An unrecorded configuration backup exists; no files changed');changes.push({path:backup,prior:null,next:config.prior,kind:'private_backup'});record.backupPath=backup;record.backupHash=digest(config.prior);record.configCreated=false;
 }else if(config&&!paths.record)record.configCreated=true;
 if(host==='deepseek'){
  const patch=join(paths.output,'cordis.yml'),change=changes.find(c=>c.path===patch);if(change)change.next=patchContents(paths.output,enabled);
  // Keep the bundle receipt aligned with the composed enabled state.
  const receiptChange=changes.find(c=>c.path===join(paths.output,'handoffglass-bundle.json'));
  if(receiptChange){const receipt=JSON.parse(receiptChange.next);receipt.files['cordis.yml']=record.patchHash;receiptChange.next=json(receipt);}
  const launcher=join(paths.state,'launch.mjs');changes.push({path:launcher,prior:await readManagedFile(launcher),next:launchContents(record),kind:'launcher'});record.launchHash=digest(launchContents(record));
 }
 if(host==='claude-code'){
  const path=join(record.marketplaceRoot,'.claude-plugin','marketplace.json'),prior=await readManagedFile(path),next=json({name:marketplace,owner:{name:'HandoffGlass'},plugins:[{name:'handoffglass',source:record.pluginSource}]});
  if(prior!==null&&digest(prior)!==paths.record?.marketplaceHash)throw Error('Claude marketplace file changed; no automatic overwrite');
  changes.push({path,prior,next,kind:'marketplace'});record.marketplaceHash=digest(next);
 }
 changes.push({path:paths.recordPath,prior:paths.raw,next:json(record),kind:'installation_record'});
 await applyFileTransaction(changes);
 try{
  if(host==='claude-code'){
   if(ownedClaude){await claude(['marketplace','update',marketplace,'--json'],options,record);await claude(['update',plugin,'--scope','user','--json'],options,record);}
   else {await claude(['marketplace','add',record.marketplaceRoot,'--scope','user','--json'],options,record);await claude(['install',plugin,'--scope','user','--json'],options,record);}
   if(!enabled)await claude(['disable',plugin,'--scope','user','--json'],options,record);
  }
 }catch(error){
  let rollbackComplete=true;
  if(host==='claude-code'&&!paths.record){try{await claude(['marketplace','remove',marketplace,'--scope','user','--json'],options,record);}catch{rollbackComplete=false;}}
  if(rollbackComplete)try{await applyFileTransaction(changes.slice().reverse().map(c=>({...c,prior:c.next,next:c.prior})));}catch{rollbackComplete=false;}
  throw Object.assign(Error('Host installation did not complete; '+(rollbackComplete?'owned changes rolled back':'recorded files retained for cleanup'),{cause:error}),{code:'host_install_failed',rollbackComplete});
 }
 return {...result,installationId,version:bundle.version,runtimeMode:mode.runtimeMode,confirmationRequired:false,applied:true,installed:true,configured:true,enabled,reloadRequired:true,state:'installed',cleanupAvailable:true,hostState:'not_observed',...(host==='deepseek'?{launchCommand:record.launchCommand,launchEnv:record.launchEnv}:{})};
}
async function setHarnessEnabledInternal(host,enabled,options={}){
 if(typeof enabled!=='boolean')throw TypeError('enabled must be boolean');
 const paths=await recordAt(host,options);if(!paths.record)return {...common(host,paths),applied:false,state:'not_installed',nextAction:'install'};
 if(!await configEvidence(host,paths))throw Error('Recorded host configuration changed; no automatic overwrite');
 if(paths.record.enabled===enabled)return {...await harnessStatus(host,options),applied:false};
 const record={...paths.record,enabled},changes=[];
 if(host==='claude-code')await claude([enabled?'enable':'disable',plugin,'--scope','user','--json'],options,record);
 else if(host==='deepseek'){
  const patch=join(paths.output,'cordis.yml'),prior=await readManagedFile(patch),next=patchContents(paths.output,enabled);record.patchHash=digest(next);changes.push({path:patch,prior,next});
  const receiptPath=join(paths.output,'handoffglass-bundle.json'),receiptRaw=await readManagedFile(receiptPath),receipt=JSON.parse(receiptRaw);receipt.files['cordis.yml']=record.patchHash;changes.push({path:receiptPath,prior:receiptRaw,next:json(receipt)});
 }else changes.push(await editConfig(host,paths,options,record,enabled));
 changes.push({path:paths.recordPath,prior:paths.raw,next:json(record)});
 try{await applyFileTransaction(changes);}catch(error){if(host==='claude-code')await claude([paths.record.enabled?'enable':'disable',plugin,'--scope','user','--json'],options,paths.record).catch(()=>{});throw error;}
 return {...await harnessStatus(host,options),applied:true,enabled,reloadRequired:true,nextAction:nextAction(host)};
}
async function cleanupHarnessInternal(host,{confirm=false,...options}={}){
 const paths=await recordAt(host,options),result={...common(host,paths),state:paths.record?'installed':'not_installed',applied:false,confirmationRequired:!confirm,changed:!!paths.record};
 if(!paths.record)return result;
 const record=paths.record,removal=await planHarnessRemoval({host,output:paths.output}),changes=[],retained=[...removal.retained];let referenceRemoved=true;
 if(!['claude-code','deepseek'].includes(host)){
  const prior=await readManagedFile(record.configPath),source=prior??'{}\n';let next=source;
  const matches=await configEvidence(host,paths);
  if(!matches){retained.push({path:record.configPath,reason:'changed_by_user'});referenceRemoved=false;}
  else{
   next=host==='opencode'?editJsoncArrayReference(source,'plugins',paths.output,false):editJsoncMember(source,['mcpServers','handoffglass'],null,{remove:true});
   const restored=jsoncValue(next,host==='opencode'?['plugins']:['mcpServers']);
   if(record.parentCreated&&((Array.isArray(restored)&&!restored.length)||restored&&typeof restored==='object'&&!Object.keys(restored).length))next=editJsoncMember(next,[host==='opencode'?'plugins':'mcpServers'],null,{remove:true});
   const empty=Object.keys(jsoncValue(next,[])??{}).length===0;
   // Restore exact original text only if no unrelated edits were added since installation.
   if(record.backupPath){const backup=await readManagedFile(record.backupPath);if(backup!==null&&digest(backup)===record.backupHash&&equal(jsoncValue(backup,[]),jsoncValue(next,[])))next=backup;}
   if(prior!==null&&prior!==next)changes.push({path:record.configPath,prior,next:record.configCreated&&empty?null:next,kind:'host_config'});
  }
 }
 if(host==='deepseek'){
  const path=join(paths.state,'launch.mjs'),prior=await readManagedFile(path);if(prior!==null){if(digest(prior)===record.launchHash)changes.push({path,prior,next:null});else{retained.push({path,reason:'changed_by_user'});referenceRemoved=false;}}
 }
 if(host==='claude-code'){
  const path=join(record.marketplaceRoot,'.claude-plugin','marketplace.json'),prior=await readManagedFile(path);
  if(prior!==null&&digest(prior)!==record.marketplaceHash){retained.push({path,reason:'changed_by_user'});referenceRemoved=false;}
  else if(prior!==null)changes.push({path,prior,next:null});
 }
 // Never remove a runtime while the host still holds an edited reference to it.
 if(referenceRemoved)changes.push(...removal.changes);
 if(record.backupPath){const prior=await readManagedFile(record.backupPath);if(prior!==null){if(digest(prior)===record.backupHash)changes.push({path:record.backupPath,prior,next:null});else retained.push({path:record.backupPath,reason:'changed_by_user'});}}
 if(referenceRemoved&&!retained.length)changes.push({path:paths.recordPath,prior:paths.raw,next:null});
 else if(referenceRemoved)changes.push({path:paths.recordPath,prior:paths.raw,next:json({...record,enabled:false,referenceRemoved:true})});
 const items=[...(host==='claude-code'&&referenceRemoved?[{path:plugin,kind:'native_plugin',action:'remove'}]:[]),...changes.map(c=>({path:c.path,kind:c.kind||'plugin_file',action:c.next===null?'remove':'restore'}))];
 if(!confirm)return {...result,items,retained,cleanupAvailable:items.length>0};
 if(host==='claude-code'&&referenceRemoved){
  const installed=await claude(['list','--json'],options,record),markets=await claude(['marketplace','list','--json'],options,record);
  if(!Array.isArray(installed)||!Array.isArray(markets))throw Error('Claude Code plugin list was not readable; no files removed');
  const market=markets.find(item=>item.name===marketplace);
  if(market&&(!market.path||resolve(market.path)!==record.marketplaceRoot))throw Error('The Claude marketplace source changed; no marketplace removed');
  if(installed.some(item=>item.id===plugin&&item.scope==='user'))await claude(['uninstall',plugin,'--scope','user','--json'],options,record);
  if(market)await claude(['marketplace','remove',marketplace,'--scope','user','--json'],options,record);
 }
 const immediate=deferManagedRemovals(changes,options.deferredRemovals,[paths.output,paths.state]);
 await applyFileTransaction(immediate);
 for(const change of immediate)await removeEmptyParents(change.path,paths.state);
 for(const path of [paths.output,record.marketplaceRoot,paths.state,join(paths.dir,'harnesses')])if(path)try{await rmdir(path);}catch{/* User-owned additions remain. */}
 return {...result,applied:changes.length>0||host==='claude-code',items,removed:immediate.map(i=>i.path),retained,complete:referenceRemoved&&!retained.length&&!options.deferredRemovals,reloadRequired:true,nextAction:nextAction(host),hostAction:nextAction(host)};
}
async function mutate(host,options,operation){
 const key=basePaths(host,options).recordPath;
 if(activeMutations.has(key))return {host,applied:false,state:'already_running',code:'already_running',nextAction:'wait_for_installation'};
 activeMutations.add(key);try{return await operation();}finally{activeMutations.delete(key);}
}
export function installHarness(host,options={}){return options.confirm?mutate(host,options,()=>installHarnessInternal(host,options)):installHarnessInternal(host,options);}
export function setHarnessEnabled(host,enabled,options={}){return mutate(host,options,()=>setHarnessEnabledInternal(host,enabled,options));}
export function cleanupHarness(host,options={}){return options.confirm?mutate(host,options,()=>cleanupHarnessInternal(host,options)):cleanupHarnessInternal(host,options);}
