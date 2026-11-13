/** Native Codex owns its cache and trust. We own only the recorded local bundle. */
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {join,resolve,sep,delimiter} from 'node:path';
import {homedir} from 'node:os';
import {readdir,rmdir,access} from 'node:fs/promises';
import {constants} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {parse} from 'smol-toml';
import {buildCodexPlugin,CODEX_PLUGIN,CODEX_MARKETPLACE} from './codex-plugin.mjs';
import {readManagedFile,readManagedBytes,readManagedLink,compareWrite,digest,removeEmptyParents,deferManagedRemovals} from './managed-files.mjs';
import {codexHookDirectory,requestCodexHook} from './hosts/codex-hooks.mjs';
import {runtimeDir} from './runtime.mjs';
const run=promisify(execFile);
const home=options=>options.codexHome||process.env.CODEX_HOME||join(options.userHome||homedir(),'.codex');
const recordPath=options=>join(home(options),'handoffglass-plugin-install.json');
const hookEnv=options=>({...process.env,CODEX_HOME:home(options),HANDOFFGLASS_RUNTIME_DIR:options.dir||runtimeDir()});
async function executable(command){
  if(command!=='codex')return command;
  for(const folder of (process.env.PATH||'').split(delimiter)){
    if(!folder)continue;
    const path=join(folder,process.platform==='win32'?'codex.exe':'codex');
    try{await access(path,constants.X_OK);return path;}catch{/* Try next PATH directory. */}
  }
  return command;
}
export async function nativeCodexPlugin(args,{codexCommand=process.env.HANDOFFGLASS_CODEX_COMMAND||'codex',...options}={}) {
  const command=codexCommand;
  const {stdout}=await run(command,['plugin',...args,'--json'],{env:hookEnv(options),timeout:45000,maxBuffer:1024*1024});
  return JSON.parse(stdout);
}
export async function installCodexPlugin(options={}) {
  const path=recordPath(options),prior=await readManagedFile(path),old=prior?JSON.parse(prior):null;
  // A desktop installation may have a bundled CLI without a PATH entry.
  // Keep using the explicit executable recorded by its successful install.
  options={...options,codexCommand:await executable(options.codexCommand||process.env.HANDOFFGLASS_CODEX_COMMAND||old?.command||'codex')};
  const configRaw=await readManagedFile(join(home(options),'config.toml')),config=configRaw?parse(configRaw):{};
  if(config.mcp_servers?.handoffglass && config.mcp_servers.handoffglass.enabled!==false)
    throw Error('A standalone handoffglass MCP entry exists. Remove that connection before installing the plugin to avoid duplicate tools.');
  const output=options.output||old?.marketplaceRoot||join(home(options),'handoffglass-local');
  if(old && output && resolve(output)!==old.marketplaceRoot)throw Error('Remove the previous local plugin bundle before changing its location.');
  const installationId=old?.installationId||randomUUID();
  const build=await buildCodexPlugin({root:options.root,command:options.nodeCommand,output,runtimeLink:options.runtimeLink??'stable',desktopRuntime:options.desktopRuntime??true,lifecycle:options.lifecycle,toolProfile:options.toolProfile,envOverrides:{CODEX_HOME:home(options),HANDOFFGLASS_CONNECTION_ID:installationId,...options.mcpEnv}});
  await nativeCodexPlugin(['marketplace','add',build.marketplaceRoot],options);
  const result=await nativeCodexPlugin(['add',CODEX_PLUGIN],options);
  await compareWrite({path,prior,next:JSON.stringify({version:1,plugin:CODEX_PLUGIN,installationId,marketplaceRoot:build.marketplaceRoot,command:options.codexCommand||process.env.HANDOFFGLASS_CODEX_COMMAND||'codex'})+'\n'});
  return {build,result,nextAction:build.lifecycle==='light'?'Open a new Codex chat. Screen drawing needs no HandoffGlass Accessibility permission or hook trust. Host observation uses its own permissions.':'Open a new Codex chat. Optional lifecycle hooks require review in Settings > Hooks; drawing works without them. No trust or permission was changed.'};
}
export async function codexPluginEvidence(options={}) {
  const configRaw=await readManagedFile(join(home(options),'config.toml')),config=configRaw?parse(configRaw):{};
  const entry=config.plugins?.[CODEX_PLUGIN],raw=await readManagedFile(recordPath(options)),record=raw?JSON.parse(raw):null;
  let configurationMatches=false,hookMode='unknown';
  if(entry&&record?.version===1&&record.plugin===CODEX_PLUGIN&&record.installationId){
    const file=join(record.marketplaceRoot,'plugins','handoffglass','.mcp.json');
    const content=await readManagedFile(file),receiptRaw=await readManagedFile(join(record.marketplaceRoot,'handoffglass-build.json'));
    const receipt=receiptRaw?JSON.parse(receiptRaw):null;
    hookMode=receipt?.lifecycle||(receipt?.files?.['plugins/handoffglass/hooks/hooks.json']?'enhanced':'unknown');
    configurationMatches=content!==null&&digest(content)===receipt?.files?.['plugins/handoffglass/.mcp.json']&&JSON.parse(content).mcpServers?.handoffglass?.env?.HANDOFFGLASS_CONNECTION_ID===record.installationId;
  }
  return {nativePlugin:!!entry,installed:!!entry,managed:!!record,enabled:entry?entry.enabled!==false:null,installationId:record?.installationId||null,configurationMatches,hookMode};
}
/** Change only this plugin's enablement; approvals and Hook trust stay host-owned. */
export async function setCodexPluginEnabled(enabled,options={}){
  if(typeof enabled!=='boolean')throw new TypeError('enabled must be boolean');
  const evidence=await codexPluginEvidence(options);
  if(!evidence.installed||!evidence.managed)throw Error('No managed Codex plugin is installed');
  const path=join(home(options),'config.toml'),prior=await readManagedFile(path),expected=parse(prior);
  expected.plugins[CODEX_PLUGIN].enabled=enabled;
  const header='[plugins."'+CODEX_PLUGIN+'"]';
  let inside=false,found=false;
  const lines=prior.split(/(?<=\n)/),nextLines=[];
  for(const line of lines){
    if(/^\s*\[/.test(line)){
      if(inside&&!found){nextLines.push('enabled = '+enabled+'\n');found=true;}
      inside=line.trim()===header;
    }
    if(inside&&/^\s*enabled\s*=/.test(line)){
      nextLines.push(line.replace(/^(\s*enabled\s*=\s*)(true|false)/,'$1'+enabled));found=true;
    }else nextLines.push(line);
  }
  if(inside&&!found)nextLines.push((prior.endsWith('\n')?'':'\n')+'enabled = '+enabled+'\n');
  const next=nextLines.join('');
  if(!isDeepStrictEqual(parse(next),expected))throw Error('Nonstandard Codex plugin config; change enablement in Codex settings');
  if(prior!==next)await compareWrite({path,prior,next});
  return {host:'codex',enabled,applied:prior!==next,reloadRequired:true,hostAction:'reload_codex',nextAction:'reload_and_call'};
}
export async function codexPluginPlan(options={}) {
  const path=recordPath(options),raw=await readManagedFile(path),items=[],retained=[],changes=[];
  if(!raw)return {state:'not_installed',changed:false,items,retained,changes};
  const record=JSON.parse(raw);
  if(record.version!==1||record.plugin!==CODEX_PLUGIN||!record.marketplaceRoot||resolve(record.marketplaceRoot)!==record.marketplaceRoot||typeof record.command!=='string')throw Error('Invalid Codex plugin installation record');
  items.push({kind:'native_plugin',action:'remove',path:CODEX_PLUGIN});
  const receiptPath=join(record.marketplaceRoot,'handoffglass-build.json'),receiptRaw=await readManagedFile(receiptPath);
  if(receiptRaw){
    const receipt=JSON.parse(receiptRaw);
    if(receipt.schemaVersion!==1||!receipt.files||typeof receipt.files!=='object')throw Error('Invalid local plugin build receipt');
    for(const [relative,expected] of Object.entries(receipt.files)){
      const file=resolve(record.marketplaceRoot,relative);
      if(relative.split(/[\\/]/).includes('..')||!file.startsWith(record.marketplaceRoot+sep)||(!relative.startsWith('plugins/handoffglass/')&&relative!=='.agents/plugins/marketplace.json')||!/^[a-f0-9]{64}$/.test(expected))throw Error('Invalid plugin file ownership');
      const kind=receipt.links?.[relative]?'symlink':undefined,prior=kind?await readManagedLink(file):await readManagedBytes(file);
      if(prior===null)continue;
      if(digest(prior)!==expected){retained.push({path:file,reason:'changed_by_user'});continue;}
      changes.push({path:file,prior,next:null,kind});
    }
    async function scan(folder,prefix=''){
      for(const entry of await readdir(folder,{withFileTypes:true})){
        const relative=prefix+entry.name;
        if(entry.isDirectory())await scan(join(folder,entry.name),relative+'/');
        else if(relative!=='handoffglass-build.json'&&!Object.hasOwn(receipt.files,relative))retained.push({path:join(folder,entry.name),reason:'not_in_installation_record'});
      }
    }
    await scan(record.marketplaceRoot);
    if(!retained.length)changes.push({path:receiptPath,prior:receiptRaw,next:null});
  }else{
    try{for(const entry of await readdir(record.marketplaceRoot))retained.push({path:join(record.marketplaceRoot,entry),reason:'no_build_receipt'});}
    catch(error){if(error.code!=='ENOENT')throw error;}
  }
  const hooks=codexHookDirectory(hookEnv(options));
  let names=[];try{names=await readdir(hooks);}catch(error){if(error.code!=='ENOENT')throw error;}
  for(const name of names){
    const file=join(hooks,name);
    if(!/^[a-f0-9]{64}\.json$/.test(name)){retained.push({path:file,reason:'unrecognized_hook_file'});continue;}
    const prior=await readManagedFile(file);if(prior===null)continue;const state=JSON.parse(prior);
    if(state.hostSession!==name.slice(0,-5)||!/^[a-f0-9]{64}$/.test(state.resumeToken||''))throw Error('Invalid private hook binding');
    changes.push({path:file,prior,next:null,hookState:state});
  }
  items.push(...changes.map(c=>({path:c.path,kind:c.hookState?'hook_binding':'plugin_file',action:'remove'})));
  return {state:'installed',changed:true,items,retained,changes,record,path,raw,hooks,plugin:true};
}
export async function removeCodexPlugin({confirm=false,...options}={}) {
  const plan=await codexPluginPlan(options);
  if(!confirm||!plan.changed)return {...plan,applied:false};
  const nativeOptions={...options,codexCommand:options.codexCommand||plan.record.command};
  // Native commands are deliberately used instead of deleting plugin/config/trust data.
  const result=await nativeCodexPlugin(['remove',CODEX_PLUGIN],nativeOptions);
  const markets=await nativeCodexPlugin(['marketplace','list'],nativeOptions);
  if(markets.marketplaces.some(m=>m.name===CODEX_MARKETPLACE))await nativeCodexPlugin(['marketplace','remove',CODEX_MARKETPLACE],nativeOptions);
  const immediate=deferManagedRemovals(plan.changes,options.deferredRemovals,[plan.record.marketplaceRoot]);
  for(const change of immediate){
    if(change.hookState){
      // Use the stored proof directly; its original host session text is not retained.
      await requestCodexHook(hookEnv(options),change.hookState,'end').catch(()=>{});
    }
    await compareWrite(change);
    await removeEmptyParents(change.path,change.hookState?(options.dir||runtimeDir()):plan.record.marketplaceRoot);
  }
  if(!plan.retained.length)await compareWrite({path:plan.path,prior:plan.raw,next:null});
  try{await rmdir(plan.record.marketplaceRoot);}catch{/* Unrecorded additions remain. */}
  return {applied:true,result,removed:immediate.map(change=>({path:change.path,kind:'plugin_file',action:'remove'})),retained:plan.retained,complete:!plan.retained.length&&!options.deferredRemovals,hostAction:'new_chat'};
}
