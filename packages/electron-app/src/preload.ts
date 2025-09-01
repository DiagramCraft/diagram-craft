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
  //  fileSave: (data: string) => ipcRenderer.invoke('filesave', data),

  platform: process.platform,

  isElectron: true
} satisfies ElectronAPI);
