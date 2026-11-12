const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('hgReview',Object.freeze({
  onRender:fn=>ipcRenderer.on('hg:review:render',(_,review)=>fn(review)),
  decide:body=>ipcRenderer.invoke('hg:review:decision',body),
  copy:()=>ipcRenderer.invoke('hg:review:copy')
}));
