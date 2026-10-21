/** Shared lifecycle service for app, MCP and CLI. Never removes an app executable. */
import { join } from 'node:path';
import { homedir } from 'node:os';
import { readdir, rmdir, lstat } from 'node:fs/promises';
import { uninstallCodex } from './codex-install.mjs';
import { readManagedFile, applyFileTransaction, removeEmptyParents, digest } from './managed-files.mjs';
import { loadPreferences, savePreferences } from './local/preferences.mjs';
import { WORKBUDDY_FILES as BUNDLE_FILES, readWorkbuddyRecord } from './workbuddy-bundle.mjs';
import { runtimeDir } from './runtime.mjs';
export const INTEGRATION_HOSTS = Object.freeze(['codex','workbuddy']);
export async function setIntegrationEnabled(enabled, {dir}={}) {
  if(typeof enabled!=='boolean') throw new TypeError('enabled must be boolean');
  const preferences=await savePreferences({enabled},dir);
  return {enabled:preferences.enabled,code:enabled?'enabled':'disabled_by_user',nextAction:enabled?'ready':'stop',settingsPreserved:true};
}
export function appWorkbuddyDirectory(dir=runtimeDir()) { return join(dir,'connectors','workbuddy-local'); }
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
  const bundles=[...new Set([appWorkbuddyDirectory(dir),join(root,'dist','workbuddy-local')])];
  const plans=await Promise.all(bundles.map(workbuddyBundlePlan));
  const retained=plans.flatMap(p=>p.retained);
  return {changed:plans.some(p=>p.changed),state:plans.every(p=>!p.changed)&&plans.some(p=>p.state==='unmanaged')?'unmanaged':retained.length?'modified':plans.some(p=>p.changed)?'bundle_ready':'not_installed',
    items:plans.flatMap(p=>p.items),retained,changes:plans.flatMap(p=>p.changes||[]),bundles,
    hostAction:'remove_connector_in_workbuddy',hostState:'not_observed'};
}
async function planFor(host,options){
  if(!INTEGRATION_HOSTS.includes(host))throw new TypeError('Unsupported integration lifecycle host');
  return host==='codex'?await uninstallCodex({...options,apply:false}):await workbuddyPlan(options);
}
function publicPlan(host,plan){
  return {host,state:plan.state,cleanupAvailable:plan.changed,items:plan.items,retained:plan.retained,
    hostAction:host==='codex'?'restart_codex':plan.hostAction,hostState:'not_observed',scope:host==='codex'?'local_config_and_skill':'local_connector_bundle',
    reloadRequired:plan.changed};
}
export async function integrationStatus(host,options={}) {
  return {...publicPlan(host,await planFor(host,options)),enabled:(await loadPreferences(options.dir)).enabled};
}
export async function cleanupIntegration(host,{confirm=false,...options}={}) {
  const plan=await planFor(host,options),result={...publicPlan(host,plan),confirmationRequired:!confirm,applied:false};
  if(!confirm||!plan.changed)return result;
  if(host==='codex'){
    const applied=await uninstallCodex({...options,apply:true});
    return {...result,applied:applied.applied,removed:applied.removed,retained:applied.retained,complete:!applied.retained.length};
  }
  await applyFileTransaction(plan.changes);
  for(const bundle of plan.bundles){
    for(const change of plan.changes)await removeEmptyParents(change.path,bundle);
    try{await rmdir(bundle);}catch{/* User additions are preserved. */}
  }
  return {...result,applied:true,removed:plan.changes.map(f=>f.path),complete:false};
}
export function lifecycleGuide(host){
  return host==='codex'?['preview_owned_files','remove_or_restore','restart_codex']:
    host==='workbuddy'?['disable_and_remove_in_workbuddy','preview_owned_files','remove_local_bundle']:[];
}
