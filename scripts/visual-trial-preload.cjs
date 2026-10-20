const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('hgTrial',Object.freeze({
 action:(name,value)=>ipcRenderer.invoke('hg:trial:action',name,value),
 onState:callback=>ipcRenderer.on('hg:trial:state',(_event,state)=>callback(state))
}));
