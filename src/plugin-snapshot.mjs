/** Runtime-only plugin snapshot. No checkout, build cache, account files or developer tools. */
import {readdir,readFile,lstat,readlink,realpath} from 'node:fs/promises';
import {join,resolve,dirname,isAbsolute,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

/** App-created connections reuse the registered App; source plugins carry their own renderer. */
export async function pluginRuntimeMode(root=fileURLToPath(new URL('../',import.meta.url)),desktop=true) {
  let pkg;
  try{pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  const appLinked=pkg?.handoffglassBuild?.schemaVersion===1;
  return {desktop:!!desktop&&!appLinked,runtimeMode:appLinked?'app-linked':desktop?'embedded':'external'};
}

export async function pluginSnapshot(root,{desktop=false}={}) {
  const mode=await pluginRuntimeMode(root,desktop);desktop=mode.desktop;
  if(desktop){
    try{
      const binary=(await readFile(join(root,'node_modules/electron/path.txt'),'utf8')).trim();
      if(!binary||isAbsolute(binary)||binary.split(/[\\/]/).includes('..'))throw Error('Invalid Electron path');
      if(!(await lstat(join(root,'node_modules/electron/dist',binary))).isFile())throw Error('Electron executable missing');
    }catch(cause){throw Object.assign(Error('Desktop runtime is not ready. Run npm ci --include=optional and finish the Electron download before building the plugin.',{cause}),{code:'desktop_runtime_missing'});}
  }
  const files=new Map(),modes={},links={};
  async function add(relative) {
    const path=join(root,relative),info=await lstat(path);
    if(info.isSymbolicLink()){
      const boundary=resolve(root,'node_modules/electron/dist'),target=await readlink(path),resolved=await realpath(path);
      if(!desktop||!path.startsWith(boundary+sep)||isAbsolute(target)||!resolve(dirname(path),target).startsWith(boundary+sep)||!resolved.startsWith((await realpath(boundary))+sep))throw Error('Runtime link leaves the Electron distribution: '+relative);
      const key='runtime/'+relative;files.set(key,target);links[key]=target;return;
    }
    if(info.isDirectory()){
      for(const item of await readdir(path))await add(relative+'/'+item);
    }else if(info.isFile()){
      const key='runtime/'+relative;
      files.set(key,await readFile(path));modes[key]=info.mode&0o777;
    }else throw Error('Unsupported runtime file: '+relative);
  }
  for(const dir of ['src','assets','skills/visual-handoff','integrations'])await add(dir);
  for(const file of ['package.json','LICENSE','NOTICE','scripts/remove-owned-files.mjs','scripts/remove-owned-files.ps1','scripts/claude-hook.mjs'])await add(file);
  // electron-builder excludes lockfiles from ASAR; keep its explicit resource
  // copy in exported snapshots so they can be rebuilt without the original App.
  const lockPath=mode.runtimeMode==='app-linked'&&root.endsWith('.asar')?join(dirname(root),'plugin-package-lock.json'):join(root,'package-lock.json');
  const lockBytes=await readFile(lockPath),lock=JSON.parse(lockBytes);
  files.set('runtime/package-lock.json',lockBytes);modes['runtime/package-lock.json']=0o644;
  // Only production dependencies. Electron's downloader/build chain is never shipped.
  for(const [path,info]of Object.entries(lock.packages)){
    if(!path.startsWith('node_modules/')||info.dev||info.optional||info.devOptional||path.includes('/node_modules/'))continue;
    await add(path);
  }
  if(desktop){
    for(const file of ['index.js','package.json','path.txt','dist'])await add('node_modules/electron/'+file);
    if(process.platform==='darwin')try{await add('native/macos/hg-locate');}catch(error){if(error.code!=='ENOENT')throw error;}
    if(process.platform==='win32')await add('native/windows/locate.ps1');
  }
  return {files,modes,links,...mode};
}
