import { contextBridge, ipcRenderer } from 'electron';
import type {
  Channel,
  ElectronAPI,
  MenuEntry
} from '@diagram-craft/electron-client-api/electron-api';

contextBridge.exposeInMainWorld('electronAPI', {
  on: (channel: Channel, callback: (action: string) => void) =>
    ipcRenderer.on(channel, (_event, action) => callback(action)),

  removeAllListeners: (channel: Channel) => ipcRenderer.removeAllListeners(channel),

  fileOpen: () => ipcRenderer.invoke('file:open'),
  fileSave: (url: string, data: string) => ipcRenderer.invoke('file:save', { url, data }),
  fileSaveAs: (url: string | undefined, data: string) =>
    ipcRenderer.invoke('file:saveAs', { url, data }),
  fileLoad: (url: string) => ipcRenderer.invoke('file:load', url),

  setMenu: (items: MenuEntry[], keybindings: Record<string, string>) =>
    ipcRenderer.invoke('menu:set', {
      items,
      keybindings
    }),
  setMenuEntryState: (id: string, state: { enabled: boolean; checked?: boolean }) =>
    ipcRenderer.invoke('menu:setState', {
      id,
      enabled: state.enabled,
      checked: state.checked
    }),

  getUsername: () => ipcRenderer.invoke('user:getUsername'),

  autosaveSave: (data: string) => ipcRenderer.invoke('autosave:save', data),
  autosaveLoad: () => ipcRenderer.invoke('autosave:load'),
  autosaveExists: () => ipcRenderer.invoke('autosave:exists'),
  autosaveClear: () => ipcRenderer.invoke('autosave:clear'),

  platform: process.platform,

  isElectron: true
} satisfies ElectronAPI);
