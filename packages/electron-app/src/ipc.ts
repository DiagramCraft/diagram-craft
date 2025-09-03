import type { BrowserWindow } from 'electron';
import type { Channel } from '@diagram-craft/electron-client-api/electron-api';

export interface IpcHandlers {
  register: (mainWindow: BrowserWindow) => void;
}

export const registerIpcHandlers = (handlers: IpcHandlers, mainWindow: BrowserWindow) =>
  handlers.register(mainWindow);

export const Channels: Record<string, Channel> = {
  MenuAction: 'menu:action',
  FileRecentFileOpen: 'file:recentFileOpen'
};
