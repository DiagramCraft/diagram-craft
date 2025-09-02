import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron';
import { readFileSync, writeFileSync } from 'fs';
import * as path from 'path';
import log from 'electron-log/main';
import type { MenuEntry } from '@diagram-craft/electron-client-api/electron-api';

const isDev = process.argv.includes('--dev');

// More reliable way to detect if running from distributable
const isPackaged = app.isPackaged;

// Configure logging
log.transports.console.level = isDev ? 'debug' : 'info';
log.transports.file.level = 'info';

log.info('Diagram Craft starting...', { isDev, isPackaged });

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
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'default',
    ...(process.platform === 'darwin'
      ? {
          titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
          trafficLightPosition: { x: 10, y: 15 }
        }
      : {}),
    show: false
  });

  let webAppUrl: string;

  if (isDev) {
    webAppUrl = 'http://localhost:5173';
  } else if (isPackaged) {
    webAppUrl = `file://${path.join(process.resourcesPath, 'main/dist/index.html')}`;
  } else {
    webAppUrl = `file://${path.join(__dirname, '../../../../main/dist/index.html')}`;
  }

  mainWindow.loadURL(webAppUrl);

  // Only open dev tools in actual development mode, not in distributable
  if (isDev && !isPackaged) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
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

  /*mainWindow.setRepresentedFilename(
    '/Users/magnusjohansson/Documents/Private/projects/diagram-craft/packages/main/public/sample/simple.json'
  );
  mainWindow.setDocumentEdited(true);*/

  mainWindow.webContents.insertCSS(`
    :root {
      font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol' !important;
    }
  
    #menu {
      app-region: drag;
      background: #373737 !important;
      
      button {
        app-region: no-drag;
      }
    }
    #main-menu {
      display: none !important;
    }
  `);
};

const showAboutDialog = (): void => {
  let iconPath: string;
  
  if (isPackaged) {
    iconPath = path.join(process.resourcesPath, 'assets/icon.png');
  } else {
    iconPath = path.join(__dirname, '../../../assets/icon.png');
  }

  dialog.showMessageBox(mainWindow!, {
    type: 'info',
    title: 'About Diagram Craft',
    message: 'Diagram Craft',
    detail: `Version: ${app.getVersion()}\nAuthor: Magnus Johansson\n\nA powerful diagramming and visualization tool.`,
    icon: iconPath,
    buttons: ['OK']
  });
};

const processMenuEntry = (
  entry: MenuEntry,
  keybindings: Record<string, string>
): Electron.MenuItemConstructorOptions => {
  const keybinding = keybindings[entry.id];

  let accelerator: string | undefined;
  if (keybinding) {
    accelerator = keybinding
      .replace('M-', 'CommandOrControl+')
      .replace('A-', 'Alt+')
      .replace('S-', 'Shift+')
      .replace('C-', 'Control+')
      .replace('Key', '');
  }

  const e: Electron.MenuItemConstructorOptions = {
    id: entry.id,
    label: entry.label,
    submenu: entry.submenu ? entry.submenu.map(k => processMenuEntry(k, keybindings)) : undefined,
    accelerator
  };

  if (entry.type === 'action') {
    e.click = () => {
      mainWindow?.webContents.send('menu-action', entry.action);
    };
  } else if (entry.type === 'toggle') {
    e.click = () => {
      mainWindow?.webContents.send('menu-action', entry.action);
    };
    e.type = 'checkbox';
  } else if (entry.type === 'separator') {
    e.type = 'separator';
  }

  return e;
};

const createMenuFrom = (entries: MenuEntry[], keybindings: Record<string, string>): void => {
  const template: Electron.MenuItemConstructorOptions[] = [];

  for (const topLevel of entries) {
    template.push(processMenuEntry(topLevel, keybindings));
  }

  if (process.platform === 'win32') {
    (template.find(e => e.id === 'file')!.submenu! as Electron.MenuItemConstructorOptions[]).push(
      ...[{ type: 'separator' as const }, { role: 'quit' as const }]
    );

    template.push({
      label: 'Help',
      submenu: [
        {
          label: 'About Diagram Craft',
          click: showAboutDialog
        }
      ]
    });
  }

  if (process.platform === 'linux') {
    template.push({
      label: 'Help',
      submenu: [
        {
          label: 'About Diagram Craft',
          click: showAboutDialog
        }
      ]
    });
  }

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        {
          label: 'About Diagram Craft',
          click: showAboutDialog
        },
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

    template.push({
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'close' }]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

app.whenReady().then(() => {
  log.info('Electron app is ready');
  Menu.setApplicationMenu(null);

  createWindow();
  //createMenu();

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
      BrowserWindow.getFocusedWindow()?.setRepresentedFilename(result.filePaths[0]);
      return { url: result.filePaths[0] };
    }
    return undefined;
  });

  ipcMain.handle('fileLoad', async (_event, rawUrl) => {
    let url: string;

    if (isPackaged) {
      url = rawUrl.replace('$STENCIL_ROOT', path.join(process.resourcesPath, 'main/dist'));
    } else {
      url = rawUrl.replace('$STENCIL_ROOT', path.join(__dirname, '../../../../main/dist'));
    }

    try {
      const content = readFileSync(url, 'utf-8');
      return { url: url, content };
    } catch (error) {
      log.error('File load error:', error);
      return undefined;
    }
  });

  ipcMain.handle('fileSave', async (_event, _action, url, content) => {
    try {
      writeFileSync(url, content);
      return url;
    } catch (error) {
      log.error('File save error:', error);
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
        BrowserWindow.getFocusedWindow()?.setRepresentedFilename(result.filePath);
        writeFileSync(result.filePath, content);
        return result.filePath;
      }

      return undefined;
    } catch (error) {
      return undefined;
    }
  });

  ipcMain.handle('menu:set', async (_event, { items, keybindings }) => {
    createMenuFrom(items, keybindings);
  });

  ipcMain.handle('menu:setState', async (_event, { id, enabled, checked }) => {
    const menuItem = Menu.getApplicationMenu()?.getMenuItemById(id);
    if (menuItem) {
      menuItem.enabled = enabled;
      menuItem.checked = checked;
    }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
