import * as path from 'node:path';
import log from 'electron-log/main';
import { isPackaged } from './platform';

export const resolveAsset = (p: string) => {
  let resolved: string;
  if (isPackaged()) {
    resolved = path.join(process.resourcesPath, 'assets', p);
  } else {
    resolved = path.join(__dirname, '../../../../assets', p);
  }
  log.info('resolveAsset', p, resolved);
  return resolved;
};

export const resolveFile = (p: string) => {
  let resolved: string;
  if (isPackaged()) {
    resolved = p
      .replace('$STENCIL_ROOT', path.join(process.resourcesPath, 'main/dist'))
      .replace('$RESOURCE_ROOT', path.join(process.resourcesPath, 'main/dist'));
  } else {
    resolved = p
      .replace('$STENCIL_ROOT', path.join(__dirname, '../../../../../main/dist'))
      .replace('$RESOURCE_ROOT', path.join(__dirname, '../../../../../main/dist'));
  }
  log.info('resolveFile', p, resolved);
  return resolved;
};
