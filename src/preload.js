'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const on = (channel) => (fn) => {
  const listener = (_e, payload) => fn(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

contextBridge.exposeInMainWorld('host', {
  onIntegrationEvent: on('integration:event'),
  onIntegrationState: on('integration:state'),
  integrationStatus: () => ipcRenderer.invoke('integration:status'),
  onCommand: on('capri:command'),
  gamingAnimationReady: () => ipcRenderer.send('gaming:animation-ready'),
  onFullscreenState: on('fullscreen:state'),
  fullscreenState: () => ipcRenderer.invoke('fullscreen:state'),
  fullscreenRendered: state => ipcRenderer.send('fullscreen:rendered', state),
  speechStart: request => ipcRenderer.invoke('speech:start', request),
  speechAudio: request => ipcRenderer.send('speech:audio', request),
  speechStop: request => ipcRenderer.invoke('speech:stop', request),
  speechCancel: request => ipcRenderer.send('speech:cancel', request),
  onSpeechState: on('speech:state'),
  onConfig: on('capri:config'),
  onResize: on('overlay:resize'),
  onWindows: on('windows:update'),
  onAgentSuggestion: on('agent:suggestion'),
  setInteractive: (on) => ipcRenderer.send('overlay:interactive', Boolean(on)),
  cursor: () => ipcRenderer.invoke('overlay:cursor'),
  getConfig: () => ipcRenderer.invoke('config:get'),
  runtimeInfo: () => ipcRenderer.invoke('runtime:info'),
  setConfig: (patch) => ipcRenderer.invoke('config:set', patch),
  listSounds: () => ipcRenderer.invoke('sounds:list'),
  demoWindow: (open) => ipcRenderer.invoke('demo:window', Boolean(open)),
  openMenu: () => ipcRenderer.send('menu:open'),
  windowsNow: () => ipcRenderer.invoke('windows:get'),
  copyImage: (rect) => ipcRenderer.invoke('panel:copy', rect),
  chatStatus: () => ipcRenderer.invoke('chat:status'),
  startOllama: () => ipcRenderer.invoke('chat:startOllama'),
  chatSend: (request) => ipcRenderer.invoke('chat:send', request),
  personalRoute: (text, id) => ipcRenderer.invoke('personal:route', text, id),
  onTaskProgress: on('task:progress'),
  openTaskResult: ref => ipcRenderer.invoke('task:openResult', ref),
  chatStop: (id) => ipcRenderer.send('chat:stop', id),
  onChatDelta: on('chat:delta'),
  openOllama: () => ipcRenderer.send('chat:ollama'),
  openApps: () => ipcRenderer.invoke('apps:list'),
  findApp: (wanted) => ipcRenderer.invoke('apps:find', wanted),
  closeApp: (name, force) => ipcRenderer.invoke('apps:close', { name, force: Boolean(force) }),
  focusOverlay: (on) => ipcRenderer.send('overlay:focus', Boolean(on)),
});
