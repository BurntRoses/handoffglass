/** One-time local setup: zero network requests, no arbitrary filesystem access from renderer. */
import { app, BrowserWindow, ipcMain, clipboard, shell } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hostConfig, HOSTS } from '../config.mjs';
import { loadPreferences, savePreferences, hasUserPreferences } from '../local/preferences.mjs';
import { getAccessibilityConsent, setAccessibilityConsent } from '../native/preferences.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const HOST_ALLOWLIST=new Set(Object.keys(HOSTS));
let window=null;
const asBoolean = v => v === true;
export function connection(host) {
  const entry=app.isPackaged ? join(process.resourcesPath,'app.asar','src','mcp.mjs') : join(here,'..','mcp.mjs');
  return hostConfig(host,{command:process.execPath,entry,compact:true,
    envOverrides:{ELECTRON_RUN_AS_NODE:'1'}});
}
function fromWindow(event){return window&&!window.isDestroyed()&&event.sender===window.webContents;}
export async function showSetup({firstRun=false}={}){
  if(window&&!window.isDestroyed()){window.show();window.focus();return window;}
  window=new BrowserWindow({
    width:580,height:730,minWidth:520,minHeight:650,show:false,backgroundColor:'#20211f',
    title:'HandoffGlass',autoHideMenuBar:true,
    webPreferences:{preload:join(here,'setup-preload.cjs'),sandbox:true,contextIsolation:true,
      nodeIntegration:false,webSecurity:true}
  });
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',e=>e.preventDefault());
  window.webContents.on('will-attach-webview',e=>e.preventDefault());
  window.on('closed',()=>{window=null;});
  await window.loadFile(join(here,'setup.html'));
  window.show();
  return window;
}
export function registerSetupIPC(){
  ipcMain.handle('hg:setup:status',async event=>{
    if(!fromWindow(event))return {ok:false};
    return {ok:true,preferences:await loadPreferences(),firstRun:!await hasUserPreferences(),
      accessibility:await getAccessibilityConsent(),platform:process.platform,hosts:Object.keys(HOSTS)};
  });
  ipcMain.handle('hg:setup:save',async(event,input)=>{
    if(!fromWindow(event)||!input||typeof input!=='object'||Array.isArray(input))return {ok:false,error:'Invalid setup'};
    // A deliberate click from the local settings window is required; all values are strictly validated.
    try {
      const {visualStyle,motion,locale,density,theme,accessibility}=input;
      if(typeof accessibility!=='boolean')return {ok:false,error:'Invalid accessibility choice'};
      const preferences=await savePreferences({visualStyle,motion,locale,density,theme});
      await setAccessibilityConsent(accessibility);
      app.emit('hg:preferences-changed');
      return {ok:true,preferences};
    } catch(error){return {ok:false,error:error.message};}
  });
  ipcMain.handle('hg:setup:preview',async(event,host)=>{
    if(!fromWindow(event)||!HOST_ALLOWLIST.has(host))return {ok:false,error:'Unknown host'};
    try{return {ok:true,content:connection(host)};}catch(error){return {ok:false,error:error.message};}
  });
  ipcMain.handle('hg:setup:copy',async(event,host)=>{
    if(!fromWindow(event)||!HOST_ALLOWLIST.has(host))return {ok:false,error:'Unknown host'};
    try{clipboard.writeText(connection(host));return {ok:true};}
    catch(error){return {ok:false,error:error.message};}
  });
  ipcMain.handle('hg:setup:permission',async event=>{
    if(!fromWindow(event))return {ok:false};
    if(process.platform!=='darwin')return {ok:false,error:'See system accessibility settings for your platform'};
    try{await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');return {ok:true};}
    catch(error){return {ok:false,error:error.message};}
  });
  ipcMain.handle('hg:setup:close',async event=>{if(!fromWindow(event))return {ok:false};window.close();return {ok:true};});
}
export async function maybeShowFirstRun(){if(!await hasUserPreferences())await showSetup({firstRun:true});}
