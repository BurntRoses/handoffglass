const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('handoffglass', {
  onRender(callback) {
    if (typeof callback === 'function') ipcRenderer.on('hg:render', (_, payload) => callback(payload));
  },
  decide(id, status) {
    if (typeof id === 'string' && ['completed', 'declined', 'cancelled'].includes(status)) {
      return ipcRenderer.invoke('hg:decision', { id, status });
    }
    return Promise.resolve({ ok: false, error: 'Invalid decision' });
  }
});
