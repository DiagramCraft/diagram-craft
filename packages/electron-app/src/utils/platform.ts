import { app } from 'electron';

export const isDev = () => process.argv.includes('--dev');

export const isPackaged = () => app.isPackaged;

export const isMac = () => process.platform === 'darwin';
