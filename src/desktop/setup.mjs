/** One-time local setup: zero network requests, no arbitrary filesystem access from renderer. */
import { app, BrowserWindow, ipcMain, clipboard, shell, dialog } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hostConfig, HOSTS } from '../config.mjs';
import { loadPreferences, hasUserPreferences } from '../local/preferences.mjs';
import { getAccessibilityConsent } from '../native/preferences.mjs';
import { updateDesktopSettings } from './settings-client.mjs';
import { prepareWorkbuddyBundle, readWorkbuddyRecord } from '../workbuddy-bundle.mjs';
import { appWorkbuddyDirectory,installIntegration,INTEGRATION_HOSTS } from '../integration-lifecycle.mjs';
import { connectionState } from '../connection-state.mjs';
import { codexPluginEvidence,installCodexPlugin } from '../codex-plugin-lifecycle.mjs';
import { nativePermissionStatus } from '../native/locator.mjs';
import {formatHostLauncher} from './host-connections.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const HOST_ALLOWLIST=new Set(Object.keys(HOSTS));
let window=null;
const asBoolean = v => v === true;
function configOptions() {
  const entry=app.isPackaged ? join(process.resourcesPath,'app.asar','src','mcp.mjs') : join(here,'..','mcp.mjs');
  return {command:process.execPath,entry,compact:true,envOverrides:{ELECTRON_RUN_AS_NODE:'1'}};
}
export function connection(host) { return hostConfig(host,configOptions()); }
let connecting=false;
export async function connectCodex() {
  if(connecting)return {ok:false,code:'already_running'};
  connecting=true;
  try {
    const userHome=app.getPath('home'),plugin=await codexPluginEvidence({userHome});
    if(plugin.installed)return {ok:true,nativePlugin:true,nextAction:plugin.enabled?'reload_and_call':'enable_in_host'};
    await installCodexPlugin({userHome,root:join(here,'../..'),nodeCommand:process.execPath,mcpEnv:{ELECTRON_RUN_AS_NODE:'1'},lifecycle:'light',toolProfile:'host'});
    return {ok:true,nativePlugin:true,nextAction:'reload_and_call'};
  }
  catch {return {ok:false,code:'install_failed'};}
  finally {connecting=false;}
}
export async function connectHost(host='codex') {
  if(host==='codex')return connectCodex();
  if(!INTEGRATION_HOSTS.includes(host))return {ok:false,code:'unsupported_host'};
  if(host!=='workbuddy'){
    try{
      const options={confirm:true,root:join(here,'../..'),userHome:app.getPath('home'),home:app.getPath('home'),command:process.execPath,envOverrides:{ELECTRON_RUN_AS_NODE:'1'}};
      if(host==='trae'){
        const chosen=await dialog.showOpenDialog({title:'TRAE · MCP configuration',properties:['openFile'],filters:[{name:'MCP configuration',extensions:['json','jsonc']}]});
        if(chosen.canceled||chosen.filePaths.length!==1)return {ok:false,code:'cancelled'};
        options.configPath=chosen.filePaths[0];
      }
      const result=await installIntegration(host,options);
      return {ok:result.applied===true,...result};
    }catch(error){return {ok:false,code:error.code||'install_failed'};}
  }
  try{return {ok:true,...await prepareWorkbuddyBundle(appWorkbuddyDirectory(),configOptions()),nextAction:'import_trust_enable_reload_in_workbuddy'};}
  catch{return {ok:false,code:'bundle_refused'};}
}
export async function revealWorkbuddyConnector() {
  try{
    const directory=appWorkbuddyDirectory();
    if(!(await readWorkbuddyRecord(directory)).record)return {ok:false,code:'not_prepared'};
    shell.showItemInFolder(join(directory,'connector-meta.json'));return {ok:true};
  }catch{return {ok:false,code:'not_prepared'};}
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
  ipcMain.handle('hg:setup:copy-launcher',async(event,host)=>{
    if(!fromWindow(event)||host!=='deepseek')return {ok:false,code:'unsupported_host'};
    try{const command=formatHostLauncher(await connectionState(host,{root:join(here,'../..'),userHome:app.getPath('home')}),process.platform);if(!command)return {ok:false,code:'not_prepared'};clipboard.writeText(command);return {ok:true};}
    catch{return {ok:false,code:'not_prepared'};}
  });
  ipcMain.handle('hg:setup:connection',async(event,host)=>{
    if(!fromWindow(event)||!INTEGRATION_HOSTS.includes(host))return {ok:false,code:'unsupported_host'};
    try{
      const r=await fetch(`http://127.0.0.1:${process.env.HANDOFFGLASS_PORT}/desktop/diagnostics`,{headers:{authorization:`Bearer ${process.env.HANDOFFGLASS_SECRET}`},signal:AbortSignal.timeout(3000)});
      return {ok:true,...await connectionState(host,{root:join(here,'../..'),userHome:app.getPath('home'),live:r.ok?await r.json():{}})};
    }catch{return {ok:false,code:'connection_state_unavailable'};}
  });
  ipcMain.handle('hg:setup:permission-status',async event=>{
    if(!fromWindow(event))return {ok:false,code:'unauthorized'};
    return {ok:true,...await nativePermissionStatus()};
  });
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
      const result=await updateDesktopSettings({visualStyle,motion,locale,density,theme,accessibility});
      app.emit('hg:preferences-changed');
      return result;
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
  ipcMain.handle('hg:setup:connect',async(event,host='codex')=>{
    if(!fromWindow(event))return {ok:false,code:'unauthorized'};
    return connectHost(host);
  });
  ipcMain.handle('hg:setup:reveal-connector',event=>fromWindow(event)?revealWorkbuddyConnector():{ok:false,code:'unauthorized'});
  ipcMain.handle('hg:setup:permission',async event=>{
    if(!fromWindow(event))return {ok:false};
    if(process.platform!=='darwin')return {ok:false,error:'See system accessibility settings for your platform'};
    try{await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');return {ok:true};}
    catch(error){return {ok:false,error:error.message};}
  });
  ipcMain.handle('hg:setup:close',async event=>{if(!fromWindow(event))return {ok:false};window.close();return {ok:true};});
}
export async function maybeShowFirstRun(){if(!await hasUserPreferences())await showSetup({firstRun:true});}
