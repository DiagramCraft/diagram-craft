import * as path from 'path';
import log from 'electron-log/main';
import { isPackaged } from './platform';

export const resolveAsset = (p: string) => {
  if (isPackaged()) {
    const res = path.join(process.resourcesPath, 'assets', p);
    log.info('resolveAsset', p, res);
    return res;
  } else {
    return path.join(__dirname, '../../../../assets', p);
  }
};

export const resolveFile = (p: string) => {
  log.info('resolveFile', p);
  if (isPackaged()) {
    const res = p
      .replace('$STENCIL_ROOT', path.join(process.resourcesPath, 'main/dist'))
      .replace('$RESOURCE_ROOT', path.join(process.resourcesPath, 'main/dist'));
    log.info('resolveFile', p, res);
    return res;
  } else {
    return p
      .replace('$STENCIL_ROOT', path.join(__dirname, '../../../../../main/dist'))
      .replace('$RESOURCE_ROOT', path.join(__dirname, '../../../../../main/dist'));
  }
};
