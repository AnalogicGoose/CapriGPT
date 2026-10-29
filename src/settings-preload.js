'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('settingsHost', {
  state: () => ipcRenderer.invoke('settings:state'),
  patch: input => ipcRenderer.invoke('settings:patch', input),
  action: (name, value) => ipcRenderer.invoke('settings:action', name, value),
  onUpdate: fn => { ipcRenderer.on('settings:updated', (_event, state) => fn(state)); },
});
