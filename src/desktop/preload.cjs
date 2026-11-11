const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('handoffglass', {
  onRender(callback) { if (typeof callback === 'function') ipcRenderer.on('hg:render', (_, payload) => callback(payload)); },
  overlayCleared(token) { if(Number.isSafeInteger(token))ipcRenderer.send('hg:overlay-empty',token); },
  decide(id, status, step) {
    if (typeof id === 'string' && ['completed', 'declined', 'cancelled'].includes(status)) return ipcRenderer.invoke('hg:decision', { id, status, step });
    return Promise.resolve({ ok:false,error:'Invalid decision' });
  },
  control(id,action,step) {
    if(typeof id==='string'&&['pause','resume','retry_target','text_fallback','park','attach'].includes(action))return ipcRenderer.invoke('hg:control',{id,action,step});
    return Promise.resolve({ok:false,error:'Invalid action'});
  },
  resize({height,compact}={}) { if(Number.isFinite(height)&&typeof compact==='boolean')ipcRenderer.send('hg:panel-size',{height,compact}); }
});
