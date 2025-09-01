import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron';
import { readFileSync, writeFileSync } from 'fs';
import * as path from 'path';

const isDev = process.argv.includes('--dev');

let mainWindow: BrowserWindow | null = null;

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true
    },
    titleBarStyle: 'default', //process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false
  });

  const webAppUrl = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../../../../main/dist/index.html')}`;

  mainWindow.loadURL(webAppUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
};

const createMenu = (): void => {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Diagram',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow?.webContents.send('menu-action', 'new-diagram');
          }
        },
        {
          label: 'Open...',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            mainWindow?.webContents.send('menu-action', 'FILE_OPEN');
          }
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow?.webContents.send('menu-action', 'save-diagram');
          }
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            mainWindow?.webContents.send('menu-action', 'FILE_SAVE_AS');
          }
        },
        { type: 'separator' },
        {
          label: 'Export...',
          click: () => {
            mainWindow?.webContents.send('menu-action', 'export-diagram');
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'close' }]
    }
  ];

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });

    (template[4].submenu as Electron.MenuItemConstructorOptions[]).push(
      { type: 'separator' },
      {
        label: 'Bring All to Front',
        role: 'front'
      }
    );
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

app.whenReady().then(() => {
  createWindow();
  createMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  ipcMain.handle('fileOpen', async (_event, _action) => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile']
      /*filters: [
        { name: 'Diagram Files', extensions: ['dcd'] },
        { name: 'All Files', extensions: ['*'] }
      ]*/
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return { url: result.filePaths[0] };
    }
    return undefined;
  });

  ipcMain.handle('fileLoad', async (_event, url) => {
    try {
      const content = readFileSync(url, 'utf-8');
      return { url: url, content };
    } catch (error) {
      console.log(error);
      return undefined;
    }
  });

  ipcMain.handle('fileSave', async (_event, _action, url, content) => {
    try {
      writeFileSync(url, content);
      return url;
    } catch (error) {
      return undefined;
    }
  });

  ipcMain.handle('fileSaveAs', async (_event, _action, url, content) => {
    try {
      const result = await dialog.showSaveDialog(mainWindow!, {
        defaultPath: url
        /*filters: [
          { name: 'Diagram Files', extensions: ['dcd'] },
          { name: 'All Files', extensions: ['*'] }
        ]*/
      });

      if (!result.canceled && result.filePath) {
        writeFileSync(result.filePath, content);
        return result.filePath;
      }

      return undefined;
    } catch (error) {
      return undefined;
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
