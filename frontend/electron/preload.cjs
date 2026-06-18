const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getDeviceFingerprint: () => ipcRenderer.invoke('get-device-fingerprint'),
})