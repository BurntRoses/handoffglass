const {contextBridge, ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('hgCenter',Object.freeze({
  read:()=>ipcRenderer.invoke('hg:center:read'),
  save:settings=>ipcRenderer.invoke('hg:center:save',settings),
  copy:host=>ipcRenderer.invoke('hg:center:copy',host),
  connect:()=>ipcRenderer.invoke('hg:center:connect'),
  preview:host=>ipcRenderer.invoke('hg:center:preview',host),
  permission:()=>ipcRenderer.invoke('hg:center:permission'),
  test:()=>ipcRenderer.invoke('hg:center:test'),
  displays:()=>ipcRenderer.invoke('hg:center:displays'),
  report:code=>ipcRenderer.invoke('hg:center:report',code)
}));
