import { isPackaged } from './mode';
import * as path from 'path';

export const resolveAsset = (p: string) => {
  if (isPackaged()) {
    return path.join(process.resourcesPath, 'assets', p);
  } else {
    return path.join(__dirname, '../../../assets', p);
  }
};

export const resolveFile = (p: string) => {
  if (isPackaged()) {
    return p
      .replace('$STENCIL_ROOT', path.join(process.resourcesPath, 'main/dist'))
      .replace('$RESOURCE_ROOT', path.join(process.resourcesPath, 'main/dist'));
  } else {
    return p
      .replace('$STENCIL_ROOT', path.join(__dirname, '../../../../main/dist'))
      .replace('$RESOURCE_ROOT', path.join(__dirname, '../../../../main/dist'));
  }
};
