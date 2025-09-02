import { app, type BrowserWindow, Menu } from 'electron';
import type { MenuEntry } from '@diagram-craft/electron-client-api/electron-api';
import { showAboutDialog } from './about-dialog';

const processMenuEntry = (
  entry: MenuEntry,
  keybindings: Record<string, string>,
  mainWindow: BrowserWindow
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
    submenu: entry.submenu
      ? entry.submenu.map(k => processMenuEntry(k, keybindings, mainWindow))
      : undefined,
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
  } else if (entry.type === 'recent') {
    // Use Electron's native recent documents
    e.role = 'recentDocuments';
    e.submenu = [
      {
        label: 'Clear Recent',
        role: 'clearRecentDocuments'
      }
    ];
  }

  return e;
};

export const createMenuFrom = (
  entries: MenuEntry[],
  keybindings: Record<string, string>,
  mainWindow: BrowserWindow
): void => {
  const template: Electron.MenuItemConstructorOptions[] = [];

  for (const topLevel of entries) {
    template.push(processMenuEntry(topLevel, keybindings, mainWindow));
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
          click: () => showAboutDialog(mainWindow)
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
          click: () => showAboutDialog(mainWindow)
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

    template.push({
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'close' }]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};
