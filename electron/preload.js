const { contextBridge, ipcRenderer } = require('electron');

// API segura exposta ao renderer (window.electronAPI).
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  openPanelWindow: () => ipcRenderer.invoke('panel:open'),
  closePanelWindow: () => ipcRenderer.invoke('panel:close'),
  onPanelClosed: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('panel:closed', listener);
    return () => ipcRenderer.removeListener('panel:closed', listener);
  },
});
