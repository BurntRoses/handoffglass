const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('hgSetup',Object.freeze({
  status:()=>ipcRenderer.invoke('hg:setup:status'),
  save:value=>ipcRenderer.invoke('hg:setup:save',value),
  copy:host=>ipcRenderer.invoke('hg:setup:copy',host),
  permission:()=>ipcRenderer.invoke('hg:setup:permission'),
  close:()=>ipcRenderer.invoke('hg:setup:close')
}));
