import type { IpcHandlers } from '../ipc';
import { BrowserWindow, ipcMain } from 'electron';
import os from 'node:os';

export const userHandlers: IpcHandlers = {
  register(_mainWindow: BrowserWindow): void {
    ipcMain.handle('user:getUsername', async (_event, _action) => {
      return os.userInfo().username;
    });
  }
};
