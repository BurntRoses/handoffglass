import {BrowserWindow,ipcMain} from 'electron';
import {execFile} from 'node:child_process';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import {loadPreferences} from '../local/preferences.mjs';
import {layoutSignature} from '../native/calibration.mjs';
import {MAX_SCREENSHOT_BYTES} from '../local/screenshot-share.mjs';

const exec=promisify(execFile);
const source=fileURLToPath(new URL('../../native/macos/',import.meta.url));
const here=fileURLToPath(new URL('./',import.meta.url));

function confirmShare(applicationName,{locale,theme},signal) {
  if(signal.aborted)return Promise.resolve(false);
  const window=new BrowserWindow({width:440,height:228,resizable:false,show:false,alwaysOnTop:true,skipTaskbar:true,acceptFirstMouse:true,
    title:'HandoffGlass',webPreferences:{preload:join(here,'screenshot-preload.cjs'),contextIsolation:true,sandbox:true}});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',event=>event.preventDefault());
  return new Promise(resolve=>{
    const finish=confirmed=>{
      signal.removeEventListener('abort',abort);
      ipcMain.removeListener('hg:capture:decision',decide);
      window.removeListener('closed',abort);
      if(!window.isDestroyed())window.destroy();
      resolve(confirmed);
    };
    const abort=()=>finish(false);
    const decide=(event,confirmed)=>{if(event.sender===window.webContents)finish(confirmed===true);};
    signal.addEventListener('abort',abort,{once:true});
    ipcMain.on('hg:capture:decision',decide);
    window.once('closed',abort);
    void window.loadFile(join(here,'screenshot.html'),{query:{applicationName,locale,theme}})
      .then(()=>{if(!window.isDestroyed())window.showInactive();},abort);
  });
}

async function applicationName(executable,appBundleId,signal) {
  try {
    const {stdout}=await exec(executable,['--application-name',appBundleId],{signal,timeout:1000,maxBuffer:4096});
    const {name}=JSON.parse(stdout);
    return typeof name==='string'&&name.trim()?name.slice(0,160):appBundleId;
  } catch {
    return appBundleId;
  }
}

export async function shareScreenshot(request,{call,displays,signal}) {
  const {captureId,appBundleId,displayId,deadline}=request;
  const finish=value=>call('POST','/desktop/capture',{captureId,...value});
  if(process.platform!=='darwin')return finish({error:'capture_unsupported'});
  if(deadline<=Date.now()||signal.aborted)return;
  const remaining=AbortSignal.any([signal,AbortSignal.timeout(deadline-Date.now())]);
  try {
    const executable=join(process.env.HANDOFFGLASS_NATIVE_RESOURCE_DIR||source,'hg-capture');
    const compiled=existsSync(executable);
    const name=compiled?await applicationName(executable,appBundleId,remaining):appBundleId;
    const confirmed=await confirmShare(name,await loadPreferences(),remaining);
    if(remaining.aborted)return;
    if(!confirmed)return await finish({error:'capture_cancelled'});
    if(layoutSignature(displays())!==request.layoutSignature)return await finish({error:'layout_changed'});
    await call('POST','/desktop/capture-approve',{captureId});
    const args=[appBundleId,...(displayId?[displayId]:[])];
    const {stdout}=compiled?await exec(executable,args,{signal:remaining,maxBuffer:MAX_SCREENSHOT_BYTES+1024}):
      await exec('/usr/bin/swift',[join(source,'capture.swift'),...args],{signal:remaining,maxBuffer:MAX_SCREENSHOT_BYTES+1024});
    const image=JSON.parse(stdout);
    if(!remaining.aborted)await finish(image);
  } catch {
    if(!remaining.aborted)await finish({error:'capture_failed'}).catch(()=>{});
  }
}
