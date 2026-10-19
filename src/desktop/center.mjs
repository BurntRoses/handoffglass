/** Persistent settings center; isolated from handoff actions and sensitive IPC. */
import { app, BrowserWindow, clipboard, ipcMain, shell } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connection } from './setup.mjs';
import { HOSTS } from '../config.mjs';
import { loadPreferences, savePreferences } from '../local/preferences.mjs';
import { getAccessibilityConsent, setAccessibilityConsent } from '../native/preferences.mjs';
import { summarizeDiagnostics } from './center-model.mjs';
import { checkLocalMcp } from '../local/mcp-probe.mjs';
import { makeSupportReport } from '../local/support-report.mjs';
import { inspectLayout } from '../native/calibration.mjs';
import metadata from '../../package.json' with { type: 'json' };
const here = dirname(fileURLToPath(import.meta.url));
const HOSTS_SET = new Set(Object.keys(HOSTS));
let center = null;
let checkRunning = false;
function authorized(event) {return center && !center.isDestroyed() && event.sender === center.webContents;}
export async function showControlCenter() {
  if (center && !center.isDestroyed()) {center.show();center.focus();return center;}
  center = new BrowserWindow({
    width:1050,height:735,minWidth:780,minHeight:630,show:false,autoHideMenuBar:true,
    backgroundColor:'#0b151b',title:'HandoffGlass · Control Center',
    webPreferences:{preload:join(here,'center-preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true}
  });
  center.webContents.setWindowOpenHandler(() => ({action:'deny'}));
  center.webContents.on('will-navigate',event=>event.preventDefault());
  center.webContents.on('will-attach-webview',event=>event.preventDefault());
  center.on('closed',()=>{center=null;});
  await center.loadFile(join(here,'center.html'));
  center.show();
  return center;
}
export function registerCenterIPC({getDiagnostics,getDisplayInfo}) {
  if (typeof getDiagnostics !== 'function' || typeof getDisplayInfo !== 'function') throw new TypeError('Diagnostics and display providers are required');
  ipcMain.handle('hg:center:read',async event=>{
    if(!authorized(event)) return {ok:false,error:'Unauthorized window'};
    try {
      const [preferences, accessibility, live] = await Promise.all([
        loadPreferences(),getAccessibilityConsent(),getDiagnostics()
      ]);
      return {ok:true,appVersion:metadata.version,preferences,accessibility,diagnostics:summarizeDiagnostics(live),
        platform:process.platform,hosts:Object.keys(HOSTS)};
    } catch(error) {return {ok:false,error:'Could not read local service state'};}
  });
  ipcMain.handle('hg:center:save',async(event,settings)=>{
    if(!authorized(event)||!settings||typeof settings!=='object'||Array.isArray(settings)) return {ok:false,error:'Invalid request'};
    const {visualStyle,motion,locale,density,theme,accessibility,...extra}=settings;
    if(Object.keys(extra).length || typeof accessibility!=='boolean')return {ok:false,error:'Invalid setting'};
    try {
      const preferences=await savePreferences({visualStyle,motion,locale,density,theme});
      await setAccessibilityConsent(accessibility);
      return {ok:true,preferences,accessibility};
    } catch(error) {return {ok:false,error:error.message};}
  });
  ipcMain.handle('hg:center:copy',async(event,host)=>{
    if(!authorized(event)||typeof host!=='string'||!HOSTS_SET.has(host))return {ok:false,error:'Unknown host'};
    try {clipboard.writeText(connection(host));return {ok:true};}
    catch {return {ok:false,error:'Cannot generate this host configuration'};}
  });
  ipcMain.handle('hg:center:preview',async(event,host)=>{
    if(!authorized(event)||typeof host!=='string'||!HOSTS_SET.has(host))return {ok:false,error:'Unknown host'};
    try {return {ok:true,content:connection(host)};}
    catch {return {ok:false,error:'Cannot generate this host configuration'};}
  });
  ipcMain.handle('hg:center:test',async event=>{
    if(!authorized(event))return {ok:false,code:'unauthorized'};
    if(checkRunning)return {ok:false,code:'already_running'};
    checkRunning=true;
    try {
      const entry=app.isPackaged ? join(process.resourcesPath,'app.asar','src','mcp.mjs') : join(here,'..','mcp.mjs');
      return await checkLocalMcp({command:process.execPath,entry,
        env:{...process.env,...(app.isPackaged?{ELECTRON_RUN_AS_NODE:'1'}:{})},timeoutMs:18000});
    } catch {return {ok:false,code:'test_unavailable'};}
    finally {checkRunning=false;}
  });
  ipcMain.handle('hg:center:report',async(event,code)=>{
    if(!authorized(event))return {ok:false,code:'unauthorized'};
    try {
      const diagnostics=summarizeDiagnostics(await getDiagnostics());
      const report=makeSupportReport({appVersion:app.getVersion(),platform:process.platform,
        diagnostics,localTest:{code}});
      clipboard.writeText(JSON.stringify(report,null,2));
      return {ok:true};
    } catch {return {ok:false,code:'report_unavailable'};}
  });
  ipcMain.handle('hg:center:displays',async event=>{
    if(!authorized(event))return {ok:false,code:'unauthorized'};
    try{
      const displays=getDisplayInfo();
      const normalized=displays.map(d=>({id:d.id,...d.bounds,scaleFactor:d.scaleFactor,physicalBounds:d.physicalBounds}));
      return {ok:true,displays,layoutCheck:inspectLayout(normalized,process.platform)};
    }
    catch{return {ok:false,code:'display_unavailable'};}
  });
  ipcMain.handle('hg:center:permission',async event=>{
    if(!authorized(event))return {ok:false,error:'Unauthorized window'};
    if(process.platform!=='darwin')return {ok:false,error:'Open Accessibility settings manually on this system'};
    try {await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');return {ok:true};}
    catch {return {ok:false,error:'Unable to open system preferences'};}
  });
}
