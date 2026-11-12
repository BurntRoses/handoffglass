/** Read-only review surface. Only review decisions and explicitly requested copy leave it. */
import {app,BrowserWindow,ipcMain,clipboard} from 'electron';
import {fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';
const here=dirname(fileURLToPath(import.meta.url));
let window=null,latest=null,registered=false,hiddenId=null,loading=null,quitting=false;
export function reviewSurface({call}){
  if(!registered){
    registered=true;
    app.on('before-quit',()=>{quitting=true;});
    ipcMain.handle('hg:review:decision',async(e,body)=>{
      if(!window||e.sender!==window.webContents||!latest||body?.id!==latest.id||body?.revision!==latest.revision)return {error:'stale_review'};
      return call('POST','/desktop/review-decision',body);
    });
    ipcMain.handle('hg:review:copy',async(e)=>{
      if(!window||e.sender!==window.webContents||!latest)return {error:'stale_review'};
      const report=await call('POST','/desktop/review-export',{id:latest.id,confirmed:true});
      clipboard.writeText(JSON.stringify(report,null,2));return {ok:true};
    });
  }
  return async review=>{
    latest=review;
    if(!review){window?.hide();return;}
    if(!window||window.isDestroyed()){
      window=new BrowserWindow({width:720,height:620,minWidth:580,minHeight:440,show:false,title:'HandoffGlass · 改动审查',autoHideMenuBar:true,
        webPreferences:{preload:join(here,'review-preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true}});
      window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',e=>e.preventDefault());
      window.webContents.on('will-attach-webview',e=>e.preventDefault());
      window.on('close',e=>{if(quitting)return;e.preventDefault();hiddenId=latest?.id;window.hide();});
      loading=window.loadFile(join(here,'review.html'));
    }
    await loading;
    if(latest!==review)return;
    window.webContents.send('hg:review:render',review);
    if(hiddenId!==review.id)window.showInactive();
  };
}
