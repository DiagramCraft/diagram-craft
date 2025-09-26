import { type IpcHandlers } from '../ipc';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { resolveFile } from '../utils/path';
import { readFileSync, writeFileSync } from 'fs';
import log from 'electron-log/main';

export const fileHandlers: IpcHandlers = {
  register(mainWindow: BrowserWindow): void {
    ipcMain.handle('file:open', async (_event, _action) => {
      const result = await dialog.showOpenDialog(mainWindow!, {
        properties: ['openFile'],
        filters: [
          { name: 'Diagram Files', extensions: ['dcd'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0]!;
        BrowserWindow.getFocusedWindow()?.setRepresentedFilename(filePath);
        app.addRecentDocument(filePath);
        return { url: filePath };
      }
      return undefined;
    });

    ipcMain.handle('file:load', async (_event, rawUrl) => {
      const url = resolveFile(rawUrl);

      try {
        const content = readFileSync(url, 'utf-8');
        return { url: url, content };
      } catch (error) {
        log.error('File load error:', error);
        return undefined;
      }
    });

    ipcMain.handle('file:save', async (_event, { url, data }) => {
      try {
        writeFileSync(url, data);
        return url;
      } catch (error) {
        log.error('File save error:', error);
        return undefined;
      }
    });

    ipcMain.handle('file:saveAs', async (_event, { url, data }) => {
      try {
        const result = await dialog.showSaveDialog(mainWindow!, {
          defaultPath: url,
          filters: [
            { name: 'Diagram Files', extensions: ['dcd'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        });

        if (!result.canceled && result.filePath) {
          BrowserWindow.getFocusedWindow()?.setRepresentedFilename(result.filePath);
          app.addRecentDocument(result.filePath);
          writeFileSync(result.filePath, data);
          return result.filePath;
        }

        return undefined;
      } catch (error) {
        return undefined;
      }
    });
  }
};
