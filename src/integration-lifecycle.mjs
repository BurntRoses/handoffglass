/** Shared, ownership-aware lifecycle service for app, MCP and CLI. */
import { join } from 'node:path';
import { homedir } from 'node:os';
import { readdir, rmdir, lstat, mkdtemp, writeFile, copyFile, open, appendFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { planApplicationFiles } from './application-installation.mjs';
import { uninstallCodex } from './codex-install.mjs';
import { codexPluginPlan, removeCodexPlugin, installCodexPlugin, setCodexPluginEnabled,codexPluginEvidence } from './codex-plugin-lifecycle.mjs';
import { readManagedFile, applyFileTransaction, removeEmptyParents, digest, managedDirectoryExists } from './managed-files.mjs';
import { loadPreferences, savePreferences } from './local/preferences.mjs';
import { WORKBUDDY_FILES as BUNDLE_FILES, readWorkbuddyRecord,prepareWorkbuddyBundle } from './workbuddy-bundle.mjs';
import { runtimeDir, readManifest, readDesktopManifest, probe } from './runtime.mjs';
import {HARNESS_HOSTS,harnessStatus,installHarness,setHarnessEnabled,cleanupHarness} from './harness-installation.mjs';
export const INTEGRATION_HOSTS = Object.freeze(['codex','workbuddy',...HARNESS_HOSTS]);
export async function setIntegrationEnabled(enabled, {dir,host,...options}={}) {
  if(typeof enabled!=='boolean') throw new TypeError('enabled must be boolean');
  if(host){
    if(host==='codex')return setCodexPluginEnabled(enabled,{dir,...options});
    if(host==='workbuddy')return {host,applied:false,enabled:null,reloadRequired:false,code:'host_action_required',nextAction:enabled?'enable_in_workbuddy':'disable_in_workbuddy'};
    if(!HARNESS_HOSTS.includes(host))throw new TypeError('Use the host plugin settings for this integration');
    return setHarnessEnabled(host,enabled,{dir,...options});
  }
  const preferences=await savePreferences({enabled},dir);
  return {enabled:preferences.enabled,code:enabled?'enabled':'disabled_by_user',nextAction:enabled?'ready':'stop',settingsPreserved:true};
}
export function appWorkbuddyDirectory(dir=runtimeDir()) { return join(dir,'connectors','workbuddy-local'); }
export async function workbuddyBundleDirectories({root,dir}={}) {
  // A packaged app.asar is a file, not a checkout containing dist/. Never
  // address its virtual children through the ownership-aware raw filesystem.
  return [...new Set([appWorkbuddyDirectory(dir),...(root&&await managedDirectoryExists(root)?[join(root,'dist','workbuddy-local')]:[])])];
}
async function workbuddyBundlePlan(bundle) {
  const {path:recordPath,raw,record}=await readWorkbuddyRecord(bundle);
  if(raw===null){
    let present=false;try{present=(await lstat(bundle)).isDirectory();}catch(error){if(error.code!=='ENOENT')throw error;}
    return {changed:false,state:present?'unmanaged':'not_installed',items:[],retained:present?[{path:bundle,reason:'no_installation_record'}]:[],hostAction:'remove_connector_in_workbuddy',hostState:'not_observed'};
  }
  const changes=[],retained=[];
  for(const file of BUNDLE_FILES){
    const path=join(bundle,file),content=await readManagedFile(path);
    if(content!==null && digest(content)===record.files[file]) changes.push({path,prior:content,next:null,kind:'connector_file',action:'remove'});
    else if(content!==null) retained.push({path,reason:'changed_by_user'});
  }
  // Unknown additions remain in place. Report them so cleanup never claims an empty bundle.
  async function scan(dir,prefix=''){
    for(const item of await readdir(dir,{withFileTypes:true})){
      const relative=prefix+item.name;
      if(item.isDirectory()) await scan(join(dir,item.name),relative+'/');
      else if(relative!=='handoffglass-files.json'&&!BUNDLE_FILES.includes(relative)) retained.push({path:join(dir,item.name),reason:'not_in_installation_record'});
    }
  }
  await scan(bundle);
  if(!retained.length) changes.push({path:recordPath,prior:raw,next:null,kind:'installation_record',action:'remove'});
  return {changed:changes.length>0,state:retained.length?'modified':'bundle_ready',items:changes.map(({path,kind,action})=>({path,kind,action})),retained,
    hostAction:'remove_connector_in_workbuddy',hostState:'not_observed',changes,bundle};
}
async function workbuddyPlan({root=join(homedir(),'HandoffGlass'),dir}={}) {
  const bundles=await workbuddyBundleDirectories({root,dir});
  const plans=await Promise.all(bundles.map(workbuddyBundlePlan));
  const retained=plans.flatMap(p=>p.retained);
  return {changed:plans.some(p=>p.changed),state:plans.every(p=>!p.changed)&&plans.some(p=>p.state==='unmanaged')?'unmanaged':retained.length?'modified':plans.some(p=>p.changed)?'bundle_ready':'not_installed',
    items:plans.flatMap(p=>p.items),retained,changes:plans.flatMap(p=>p.changes||[]),bundles,
    hostAction:'remove_connector_in_workbuddy',hostState:'not_observed'};
}
async function planFor(host,options){
  if(!INTEGRATION_HOSTS.includes(host))throw new TypeError('Unsupported integration lifecycle host');
  if(HARNESS_HOSTS.includes(host))return harnessStatus(host,options);
  if(host!=='codex')return workbuddyPlan(options);
  const legacy=await uninstallCodex({...options,apply:false}),plugin=await codexPluginPlan(options);
  return {...legacy,state:plugin.changed?plugin.state:legacy.state,changed:legacy.changed||plugin.changed,
    items:[...legacy.items,...plugin.items],retained:[...legacy.retained,...plugin.retained],plugin};
}
function publicPlan(host,plan){
  return {host,state:plan.state,cleanupAvailable:plan.changed,items:plan.items,retained:plan.retained,...(plan.plugin?.changed?{nativePlugin:true}:{}),
    hostAction:host==='codex'?'restart_codex':plan.hostAction,hostState:'not_observed',scope:host==='codex'?(plan.plugin?.changed?'plugin_bundle_and_host':'local_config_and_skill'):'local_connector_bundle',
    reloadRequired:plan.changed};
}
export async function integrationStatus(host,options={}) {
  if(HARNESS_HOSTS.includes(host))return {...await harnessStatus(host,options),globalEnabled:(await loadPreferences(options.dir)).enabled};
  const plan=await planFor(host,options),plugin=host==='codex'?await codexPluginEvidence(options):null;
  return {...publicPlan(host,plan),enabled:(await loadPreferences(options.dir)).enabled,...(plugin?.nativePlugin?{installed:plugin.installed,hostEnabled:plugin.enabled}:{})};
}
export async function cleanupIntegration(host,{confirm=false,...options}={}) {
  if(HARNESS_HOSTS.includes(host))return cleanupHarness(host,{confirm,...options});
  const plan=await planFor(host,options),result={...publicPlan(host,plan),confirmationRequired:!confirm,applied:false};
  if(!confirm||!plan.changed)return result;
  if(host==='codex'){
    const plugin=plan.plugin.changed?await removeCodexPlugin({...options,confirm:true}):null;
    const applied=await uninstallCodex({...options,apply:true});
    const retained=[...applied.retained,...(plugin?.retained||[])];
    return {...result,applied:applied.applied||!!plugin?.applied,removed:[...(applied.removed||[]),...(plugin?.removed||[])],retained,complete:!retained.length};
  }
  await applyFileTransaction(plan.changes);
  for(const bundle of plan.bundles){
    for(const change of plan.changes)await removeEmptyParents(change.path,bundle);
    try{await rmdir(bundle);}catch{/* User additions are preserved. */}
  }
  return {...result,applied:true,removed:plan.changes.map(f=>f.path),complete:false};
}
export function lifecycleGuide(host){
  if(HARNESS_HOSTS.includes(host))return ['preview_owned_files','install_or_enable_in_host','reload_host','call_connection_status','remove_or_restore'];
  return host==='codex'?['preview_owned_files','remove_or_restore','restart_codex']:
    host==='workbuddy'?['disable_and_remove_in_workbuddy','preview_owned_files','remove_local_bundle']:[];
}
export async function installIntegration(host,options={}){
  if(host==='codex'){
    if(!options.confirm)return {host,applied:false,confirmationRequired:true,items:[{kind:'native_plugin',action:'install'}],nextAction:'install_native_plugin'};
    const result=await installCodexPlugin({...options,userHome:options.userHome,nodeCommand:options.command});
    return {host,applied:true,installed:true,reloadRequired:true,hostState:'not_observed',nextAction:'reload_and_call',lifecycle:result.build.lifecycle,runtimeMode:result.build.runtimeMode};
  }
  if(host==='workbuddy'){
    if(!options.confirm)return {host,applied:false,confirmationRequired:true,items:[{kind:'connector',action:'prepare'}],nextAction:'prepare_connector'};
    const result=await prepareWorkbuddyBundle(appWorkbuddyDirectory(options.dir),options.configOptions);
    return {host,...result,applied:true,installed:true,hostState:'not_observed',nextAction:'import_trust_enable_reload_and_call'};
  }
  if(!HARNESS_HOSTS.includes(host))throw new TypeError('Unsupported integration');
  return installHarness(host,options);
}

/** Preview/apply the same full removal plan from desktop, CLI or MCP. */
export async function uninstallApplication({confirm=false,waitPids=[process.pid],spawnFn=spawn,...options}={}) {
  const integrations=await Promise.all(INTEGRATION_HOSTS.map(host=>cleanupIntegration(host,{...options,confirm:false})));
  const files=await planApplicationFiles(options);
  const result={scope:'application',confirmationRequired:!confirm,scheduled:false,applied:false,
    items:[...integrations.flatMap(p=>p.items),...files.entries.map(({path,kind})=>({path,kind,action:'remove'}))],
    retained:[...integrations.flatMap(p=>p.retained),...files.retained],
    applicationRecorded:files.applicationRecorded,
    hostActions:integrations.filter(p=>p.items.length).map(p=>({host:p.host,action:p.hostAction}))};
  if(!confirm)return result;
  if(!waitPids.every(pid=>Number.isInteger(pid)&&pid>0))throw new TypeError('Invalid shutdown process list');
  // This module may itself be running inside a plugin that is about to be
  // removed. Prepare the independent remover before touching any host bundle.
  const stage=await mkdtemp(join(tmpdir(),'handoffglass-uninstall-'));
  const windows=process.platform==='win32',script=join(stage,windows?'remove.ps1':'remove.mjs');
  await copyFile(new URL(windows?'../scripts/remove-owned-files.ps1':'../scripts/remove-owned-files.mjs',import.meta.url),script);
  const deferredRemovals=[];
  const applied=[];
  for(const host of INTEGRATION_HOSTS)applied.push(await cleanupIntegration(host,{...options,confirm:true,deferredRemovals}));
  const finalFiles=await planApplicationFiles(options),dir=options.dir||runtimeDir();
  const broker=await readManifest(dir),desktop=await readDesktopManifest(dir);
  const liveBroker=broker && desktop?.pid===broker.pid && desktop.port===broker.port && await probe(broker) ? broker : null;
  const shutdownPids=[...new Set([...waitPids,...(liveBroker?[liveBroker.pid]:[])])];
  // Remove only empty container directories left by owned connector removal.
  const allEntries=[...deferredRemovals,...finalFiles.entries,{path:join(dir,'harnesses'),kind:'directory'},{path:join(dir,'connectors'),kind:'directory'},{path:dir,kind:'directory'}];
  const uniqueEntries=[...new Map(allEntries.map(entry=>[entry.path,entry])).values()];
  const entries=[...uniqueEntries.filter(e=>e.kind!=='directory'),...uniqueEntries.filter(e=>e.kind==='directory').sort((a,b)=>b.path.length-a.path.length)];
  const resultPath=join(stage,'result.json'),planPath=join(stage,'plan.json'),readyPath=join(stage,'ready');
  await writeFile(planPath,JSON.stringify({entries,waitPids:shutdownPids,resultPath,readyPath,
    priorRetained:[...applied.flatMap(p=>p.retained),...finalFiles.retained],hostActions:result.hostActions}),{mode:0o600,flag:'wx'});
  const workerLogPath=join(stage,'worker.log'),workerErrorPath=join(stage,'worker-error.log');
  const workerLog=await open(windows?join(stage,'launcher.log'):workerLogPath,'a',0o600);
  const quote=value=>"'"+value.replaceAll("'","''")+"'";
  const windowsLaunch=windows?`$ErrorActionPreference='Stop'; Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList @('-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',${quote('"'+script+'"')},${quote('"'+planPath+'"')}) -WindowStyle Hidden -RedirectStandardOutput ${quote(workerLogPath)} -RedirectStandardError ${quote(workerErrorPath)}`:null;
  const workerEnv={...process.env,ELECTRON_RUN_AS_NODE:'1'};
  if(windows)for(const key of Object.keys(workerEnv))if(key.toLowerCase()==='psmodulepath')delete workerEnv[key];
  let child;
  try{child=spawnFn(windows?'powershell.exe':process.execPath,
    windows?['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-Command',windowsLaunch]:[script,planPath],
    // Start-Process creates an independent hidden Windows console. Merely
    // unref'ing a child leaves it attached to a console that exits with the app.
    {detached:!windows,windowsHide:true,stdio:['ignore',workerLog.fd,workerLog.fd],env:workerEnv});
    child.once('exit',(code,signal)=>{void appendFile(windows?join(stage,'launcher.log'):workerLogPath,`worker_exit:${code ?? signal}\n`).catch(()=>{});});
    await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});child.unref();
  }finally{await workerLog.close();}
  // Do not exit the calling GUI before the external runtime has loaded its
  // plan. A successful OS spawn can still exit without executing the script.
  const startDeadline=Date.now()+15000;let workerReady=false;
  while(Date.now()<startDeadline){
    try{workerReady=(await readFile(readyPath,'utf8'))==='ready';}catch(error){if(error.code!=='ENOENT')throw error;}
    if(workerReady)break;
    if((child.exitCode!==null&&(!windows||child.exitCode!==0))||child.signalCode!==null)break;
    await new Promise(resolve=>setTimeout(resolve,40));
  }
  if(!workerReady)throw Object.assign(new Error('External remover did not start; review '+workerLogPath),{code:'uninstaller_startup_failed'});
  // App/MCP callers quit after returning their result. The standalone CLI must
  // also stop the authenticated runtime before its external worker removes it.
  if(liveBroker && liveBroker.pid!==process.pid)try{
    const response=await fetch(`http://127.0.0.1:${liveBroker.port}/desktop/shutdown`,{method:'POST',
      headers:{authorization:`Bearer ${desktop.desktopToken}`,'content-type':'application/json'},body:'{}',signal:AbortSignal.timeout(2000)});
    if(!response.ok)result.retained.push({path:dir,reason:'runtime_shutdown_not_acknowledged'});
  }catch{result.retained.push({path:dir,reason:'runtime_shutdown_not_acknowledged'});}
  return {...result,applied:true,scheduled:true,confirmationRequired:false,resultPath,workerLogPath,workerErrorPath,
    removed:applied.flatMap(p=>p.removed||[]),retained:[...applied.flatMap(p=>p.retained),...finalFiles.retained,...result.retained.filter(r=>r.reason==='runtime_shutdown_not_acknowledged')],
    nextAction:'exit_handoffglass_then_read_uninstall_result',complete:false};
}
