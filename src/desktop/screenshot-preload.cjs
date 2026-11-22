const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('hgScreenshot',Object.freeze({decide:value=>ipcRenderer.send('hg:capture:decision',value===true)}));
