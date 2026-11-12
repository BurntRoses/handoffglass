/** Owned desktop footprint. File snapshots allow removal without deleting additions or edits. */
import { join, resolve, basename, sep } from 'node:path';
import { homedir } from 'node:os';
import { lstat, readdir, readlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { assertPrivatePath, readManagedFile, applyFileTransaction } from './managed-files.mjs';
import { runtimeDir, secureRuntimeDir } from './runtime.mjs';
import { validatePreferences } from './local/preferences.mjs';

export const APPLICATION_RECORD='application-installation.json';
export async function fileDigest(path) {
  const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);return hash.digest('hex');
}
export async function snapshotTree(root,{allowLinks=false}={}) {
  await assertPrivatePath(root);const entries=[];
  async function scan(path) {
    const stat=await lstat(path);
    if(stat.isSymbolicLink()) {
      if(!allowLinks)throw new Error('Refusing a symbolic link in application data');
      entries.push({path,kind:'link',value:await readlink(path)});return;
    }
    if(stat.isDirectory()) {
      for(const name of await readdir(path))await scan(join(path,name));
      entries.push({path,kind:'directory'});
    } else if(stat.isFile())entries.push({path,kind:'file',digest:await fileDigest(path)});
    else throw new Error('Unsupported application file');
  }
  try{await scan(root);}catch(error){if(error.code!=='ENOENT')throw error;}
  return entries;
}
function dataLocations(userHome,platform) {
  const base=resolve(userHome);
  return platform==='darwin'?[
    join(base,'Library','Application Support','HandoffGlass'),join(base,'Library','Caches','HandoffGlass'),
    join(base,'Library','Logs','HandoffGlass'),join(base,'Library','Preferences','dev.handoffglass.desktop.plist'),
    join(base,'Library','Saved Application State','dev.handoffglass.desktop.savedState')]:platform==='win32'?[
    join(base,'AppData','Roaming','HandoffGlass'),join(base,'AppData','Local','HandoffGlass'),
    join(base,'AppData','Local','handoffglass-updater')]:[];
}
function allowedDataPath(path,userHome,platform) {
  const p=resolve(path);
  return dataLocations(userHome,platform).some(candidate=>candidate===p || (platform!=='linux' && candidate.toLowerCase()===p.toLowerCase()));
}
async function appIdentity(path,platform) {
  if(platform==='darwin') {
    if(basename(path)!=='HandoffGlass.app')throw new Error('Unexpected application bundle');
    const plist=await readManagedFile(join(path,'Contents','Info.plist'));
    if(!/<key>CFBundleIdentifier<\/key>\s*<string>dev\.handoffglass\.desktop<\/string>/.test(plist||''))throw new Error('Application identity does not match');
    return {path,identityPath:join(path,'Contents','Info.plist'),identityDigest:await fileDigest(join(path,'Contents','Info.plist'))};
  }
  if(platform==='win32') {
    if(basename(path).toLowerCase()!=='handoffglass')throw new Error('Unexpected application directory');
    const executable=join(path,'HandoffGlass.exe');
    if(!(await lstat(executable)).isFile() || !(await lstat(join(path,'resources','app.asar'))).isFile())throw new Error('Application identity does not match');
    return {path,identityPath:executable,identityDigest:await fileDigest(executable)};
  }
  throw new Error('Unsupported application installation');
}
export async function readApplicationInstallation({dir=runtimeDir(),userHome=homedir(),platform=process.platform}={}) {
  const path=join(dir,APPLICATION_RECORD),raw=await readManagedFile(path);
  if(raw===null)return {path,raw,record:null};
  const record=JSON.parse(raw);
  if(record.version!==1 || record.product!=='dev.handoffglass.desktop' || record.platform!==platform ||
    !Array.isArray(record.dataPaths) || record.dataPaths.some(p=>!allowedDataPath(p,userHome,platform)) ||
    !Array.isArray(record.entries))throw new Error('Invalid application installation record');
  if(record.application) {
    const root=resolve(record.application.path);
    if(record.entries.some(e=>typeof e.path!=='string'||resolve(e.path)!==e.path||!(e.path===root||e.path.startsWith(root+sep))||!['file','link','directory'].includes(e.kind)||
      (e.kind==='file'&&!/^[0-9a-f]{64}$/.test(e.digest||''))||(e.kind==='link'&&typeof e.value!=='string')))throw new Error('Invalid application ownership');
    await assertPrivatePath(root);
  } else if(record.entries.length)throw new Error('Missing application ownership');
  return {path,raw,record};
}
export async function registerApplicationInstallation({dir=runtimeDir(),userHome=homedir(),appPath,dataPaths=[],platform=process.platform,appVersion='unknown'}={}) {
  await secureRuntimeDir(dir);
  const saved=await readApplicationInstallation({dir,userHome,platform});
  for(const path of dataPaths)if(!allowedDataPath(path,userHome,platform))throw new Error('Unrecognized application data directory');
  const application=appPath?await appIdentity(resolve(appPath),platform):null;
  if(saved.record?.application?.path===application?.path && saved.record?.appVersion===appVersion)return saved.record;
  let entries=application?await snapshotTree(application.path,{allowLinks:true}):[];
  // During an update, files not present in the former package are kept out of the
  // removal list unless they are part of a freshly installed package directory.
  if(application && saved.record?.application?.path===application.path) {
    const previous=new Set(saved.record.entries.map(e=>e.path));
    entries=entries.filter(e=>previous.has(e.path));
  }
  const record={version:1,product:'dev.handoffglass.desktop',platform,appVersion,application,
    dataPaths:[...new Set([...dataPaths,...(application?dataLocations(userHome,platform):[])].map(p=>resolve(p)))],entries,registeredAt:Date.now()};
  await applyFileTransaction([{path:saved.path,prior:saved.raw,next:JSON.stringify(record,null,2)+'\n'}]);
  return record;
}
export async function planApplicationFiles(options={}) {
  const {dir=runtimeDir(),userHome=homedir(),platform=process.platform}=options;
  const saved=await readApplicationInstallation({dir,userHome,platform}),entries=[],retained=[];
  if(saved.record?.application) {
    const app=saved.record.application;
    try {
      const verified=await appIdentity(app.path,platform);
      if(verified.identityDigest!==app.identityDigest)retained.push({path:app.path,reason:'application_changed_since_install'});
      else entries.push(...saved.record.entries);
    }catch(error){if(error.code!=='ENOENT')retained.push({path:app.path,reason:'application_identity_not_verified'});}
  }
  for(const path of saved.record?.dataPaths||[]){
    try{
      if(/[\\/](Application Support|Roaming)[\\/]handoffglass$/i.test(path)) {
        // Electron-owned storage names are known; files a user adds alongside them remain.
        const known=new Set(['Cache','Code Cache','GPUCache','GPUPersistentCache','GraphiteDawnCache','DawnCache','DawnGraphiteCache','DawnWebGPUCache','Session Storage','Local Storage','Network','Crashpad','Dictionaries','Preferences','Local State','Cookies','Cookies-journal','Network Persistent State','TransportSecurity','blob_storage','logs','SharedStorage','SharedStorage-wal','SharedStorage-journal','Shared Dictionary','Trust Tokens','Trust Tokens-journal','DIPS','DIPS-wal','DIPS-shm','declarative_performance_observer.db','declarative_performance_observer.db-journal','declarative_performance_observer.db-wal','declarative_performance_observer.db-shm']);
        let names=[];try{names=await readdir(path);}catch(error){if(error.code!=='ENOENT')throw error;}
        for(const name of names){if(known.has(name))entries.push(...await snapshotTree(join(path,name)));else retained.push({path:join(path,name),reason:'not_in_installation_record'});}
        entries.push({path,kind:'directory'});
      }else entries.push(...await snapshotTree(path));
    }catch{retained.push({path,reason:'unsafe_application_data'});}
  }
  // The runtime is a fixed filename allowlist, not a recursive directory delete.
  const names=['preferences.json','accessibility.json','broker.json','desktop.json','session-checkpoint.json'];
  for(const name of names){const path=join(dir,name);try{
    const content=await readManagedFile(path);if(content===null)continue;
    const value=JSON.parse(content);
    if(name==='preferences.json'){if(value.version!==1)throw Error();validatePreferences(value);}
    else if(name==='accessibility.json'){if(value.version!==1 || typeof value.consent!=='boolean')throw Error();}
    else if(name==='session-checkpoint.json'){if(value.version!==1 || !/^[0-9a-f-]{36}$/.test(value.id||''))throw Error();}
    else if(!Number.isInteger(value.pid)||value.pid<=0||!Number.isInteger(value.port)||!(/^[a-f0-9]{64}$/).test(name==='desktop.json'?value.desktopToken||'':value.token||''))throw Error();
    entries.push({path,kind:'file',digest:await fileDigest(path)});
  }catch{retained.push({path,reason:'unsafe_runtime_file'});}}
  if(saved.raw!==null)entries.push({path:saved.path,kind:'file',digest:await fileDigest(saved.path)});
  entries.push({path:resolve(dir),kind:'directory'});
  return {entries,retained,applicationRecorded:!!saved.record?.application};
}
