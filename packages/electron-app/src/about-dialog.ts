import { app, type BrowserWindow, dialog } from 'electron';
import { resolveAsset } from './utils/path';

export const showAboutDialog = (mainWindow: BrowserWindow): void => {
  dialog.showMessageBox(mainWindow!, {
    type: 'info',
    title: 'About Diagram Craft',
    message: 'Diagram Craft',
    detail: `Version: ${app.getVersion()}\nAuthor: Magnus Johansson\n\nA powerful diagramming and visualization tool.`,
    icon: resolveAsset('icon.png'),
    buttons: ['OK']
  });
};
