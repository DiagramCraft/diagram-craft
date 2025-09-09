import { type IpcHandlers } from '../ipc';
import { app, BrowserWindow, ipcMain } from 'electron';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { unlink, access } from 'fs/promises';
import { join } from 'path';
import log from 'electron-log/main';

const AUTOSAVE_FILENAME = 'diagram-craft-autosave.json';

const getAutosaveDirectory = (): string => {
  const userDataPath = app.getPath('userData');
  const autosaveDir = join(userDataPath, 'autosave');
  
  // Ensure directory exists
  if (!existsSync(autosaveDir)) {
    mkdirSync(autosaveDir, { recursive: true });
  }
  
  return autosaveDir;
};

const getAutosaveFilePath = (): string => {
  return join(getAutosaveDirectory(), AUTOSAVE_FILENAME);
};

export const autosaveHandlers: IpcHandlers = {
  register(_mainWindow: BrowserWindow): void {
    ipcMain.handle('autosave:save', async (_event, data: string) => {
      try {
        const filePath = getAutosaveFilePath();
        writeFileSync(filePath, data, 'utf-8');
        log.debug('Autosave saved to:', filePath);
        return true;
      } catch (error) {
        log.error('Autosave save error:', error);
        return false;
      }
    });

    ipcMain.handle('autosave:load', async (_event) => {
      try {
        const filePath = getAutosaveFilePath();
        if (!existsSync(filePath)) {
          return null;
        }

        const content = readFileSync(filePath, 'utf-8');
        log.debug('Autosave loaded from:', filePath);
        return content;
      } catch (error) {
        log.error('Autosave load error:', error);
        return null;
      }
    });

    ipcMain.handle('autosave:exists', (_event) => {
      try {
        const filePath = getAutosaveFilePath();
        return existsSync(filePath);
      } catch (error) {
        log.error('Autosave exists check error:', error);
        return false;
      }
    });

    ipcMain.handle('autosave:clear', async (_event) => {
      try {
        const filePath = getAutosaveFilePath();
        try {
          await access(filePath);
          await unlink(filePath);
          log.debug('Autosave cleared:', filePath);
        } catch (accessError) {
          // File doesn't exist, which is fine for clearing
        }
        return true;
      } catch (error) {
        log.error('Autosave clear error:', error);
        return false;
      }
    });
  }
};