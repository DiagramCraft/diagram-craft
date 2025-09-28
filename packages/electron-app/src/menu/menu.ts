import { app, type BrowserWindow, ipcMain, Menu } from 'electron';
import { showAboutDialog } from '../about-dialog';
import { convertKeybindingToAccelerator } from './keybinding';
import { Channels, type IpcHandlers } from '../ipc';
import { type MenuEntry } from '@diagram-craft/electron-client-api/electron-api';
import { isLinux, isMac, isWindows } from '../utils/platform';

export const menuHandlers: IpcHandlers = {
  register(mainWindow: BrowserWindow): void {
    ipcMain.handle('menu:set', async (_event, { items, keybindings }) => {
      createMenu(items, keybindings, mainWindow);
    });

    ipcMain.handle('menu:setState', async (_event, { id, enabled, checked }) => {
      const menuItem = Menu.getApplicationMenu()?.getMenuItemById(id);
      if (menuItem) {
        menuItem.enabled = enabled;
        menuItem.checked = checked;
      }
    });
  }
};

const createMenuItem = (
  entry: MenuEntry,
  keybindings: Record<string, string>,
  mainWindow: BrowserWindow
): Electron.MenuItemConstructorOptions => {
  const keybinding = keybindings[entry.id];
  const accelerator = keybinding ? convertKeybindingToAccelerator(keybinding) : undefined;

  const menuItem: Electron.MenuItemConstructorOptions = {
    id: entry.id,
    label: entry.label,
    submenu: entry.submenu
      ? entry.submenu.map(k => createMenuItem(k, keybindings, mainWindow))
      : undefined,
    accelerator
  };

  if (entry.type === 'action' || entry.type === 'toggle') {
    menuItem.click = () => {
      mainWindow?.webContents.send(Channels.MenuAction, entry.action);
    };
  }

  if (entry.type === 'toggle') {
    menuItem.type = 'checkbox';
  } else if (entry.type === 'separator') {
    menuItem.type = 'separator';
  } else if (entry.type === 'recent') {
    menuItem.role = 'recentDocuments';
    menuItem.submenu = [{ label: 'Clear Recent', role: 'clearRecentDocuments' }];
  }

  return menuItem;
};

export const createMenu = (
  entries: MenuEntry[],
  keybindings: Record<string, string>,
  mainWindow: BrowserWindow
): void => {
  const dest: Electron.MenuItemConstructorOptions[] = [];

  for (const topLevel of entries) {
    dest.push(createMenuItem(topLevel, keybindings, mainWindow));
  }

  if (isWindows()) {
    (dest.find(e => e.id === 'file')!.submenu! as Electron.MenuItemConstructorOptions[]).push(
      ...[{ type: 'separator' as const }, { role: 'quit' as const }]
    );

    dest.push({
      label: 'Help',
      submenu: [
        {
          label: 'About Diagram Craft',
          click: () => showAboutDialog(mainWindow)
        }
      ]
    });
  } else if (isLinux()) {
    dest.push({
      label: 'Help',
      submenu: [
        {
          label: 'About Diagram Craft',
          click: () => showAboutDialog(mainWindow)
        }
      ]
    });
  } else if (isMac()) {
    dest.unshift({
      label: app.getName(),
      submenu: [
        {
          label: 'About Diagram Craft',
          click: () => showAboutDialog(mainWindow)
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

    dest.push({
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'close' }]
    });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(dest));
};
