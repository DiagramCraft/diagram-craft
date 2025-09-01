import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI } from '@diagram-craft/main/electron-api';

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

  platform: process.platform,

  isElectron: true
} satisfies ElectronAPI);
