import log from 'electron-log/main';
import { isDev, isPackaged } from './utils/platform';

export const initializeLogging = () => {
  // Configure logging
  log.transports.console.level = isDev() ? 'debug' : 'info';
  log.transports.file.level = 'info';

  log.info('Diagram Craft starting...', { isDev: isDev(), isPackaged: isPackaged() });
};
