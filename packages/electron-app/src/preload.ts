import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI, MenuEntry } from '@diagram-craft/electron-client-api/electron-api';

contextBridge.exposeInMainWorld('electronAPI', {
  onMenuAction: (callback: (action: string) => void) => {
    ipcRenderer.on('menu-action', (_event, action) => callback(action));
  },

  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },

  fileOpen: () => ipcRenderer.invoke('fileOpen'),
  fileSave: (url: string, data: string) => ipcRenderer.invoke('fileSave', { url, data }),
  fileSaveAs: (url: string | undefined, data: string) =>
    ipcRenderer.invoke('fileSaveAs', { url, data }),
  fileLoad: (url: string) => ipcRenderer.invoke('fileLoad', url),

  setMenu: (items: MenuEntry[]) => ipcRenderer.invoke('menu:set', items),
  setMenuEntryState: (id: string, state: { enabled: boolean; checked?: boolean }) =>
    ipcRenderer.invoke('menu:setState', { id, enabled: state.enabled, checked: state.checked }),

  platform: process.platform,

  isElectron: true
} satisfies ElectronAPI);
