const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('hgSetup',Object.freeze({
  connection:host=>ipcRenderer.invoke('hg:setup:connection',host),
  permissionStatus:()=>ipcRenderer.invoke('hg:setup:permission-status'),
  status:()=>ipcRenderer.invoke('hg:setup:status'),
  save:value=>ipcRenderer.invoke('hg:setup:save',value),
  copy:host=>ipcRenderer.invoke('hg:setup:copy',host),
  connect:host=>ipcRenderer.invoke('hg:setup:connect',host),
  revealConnector:()=>ipcRenderer.invoke('hg:setup:reveal-connector'),
  preview:host=>ipcRenderer.invoke('hg:setup:preview',host),
  permission:()=>ipcRenderer.invoke('hg:setup:permission'),
  close:()=>ipcRenderer.invoke('hg:setup:close')
}));
