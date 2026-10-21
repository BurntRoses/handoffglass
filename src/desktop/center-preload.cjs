const {contextBridge, ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('hgCenter',Object.freeze({
  setEnabled:enabled=>ipcRenderer.invoke('hg:center:enabled',enabled),
  read:()=>ipcRenderer.invoke('hg:center:read'),
  save:settings=>ipcRenderer.invoke('hg:center:save',settings),
  copy:host=>ipcRenderer.invoke('hg:center:copy',host),
  connect:host=>ipcRenderer.invoke('hg:center:connect',host),
  revealConnector:()=>ipcRenderer.invoke('hg:center:reveal-connector'),
  preview:host=>ipcRenderer.invoke('hg:center:preview',host),
  permission:()=>ipcRenderer.invoke('hg:center:permission'),
  test:()=>ipcRenderer.invoke('hg:center:test'),
  displays:()=>ipcRenderer.invoke('hg:center:displays'),
  displaySettings:()=>ipcRenderer.invoke('hg:center:display-settings'),
  report:code=>ipcRenderer.invoke('hg:center:report',code),
  lifecycleStatus:host=>ipcRenderer.invoke('hg:center:lifecycle-status',host),
  cleanup:(host,confirm)=>ipcRenderer.invoke('hg:center:cleanup',host,confirm)
}));
