import { AppConfig } from './appConfig';
import { Random } from '@diagram-craft/utils/random';
import { MultiWindowAutosave } from './react-app/autosave/MultiWindowAutosave';
import { ElectronAutosave } from './react-app/autosave/ElectronAutosave';
import { FileSystem } from '@diagram-craft/canvas-app/loaders';
import {
  embedElementDefinitions,
  embedStencilConfig,
  embedStencilLoaders,
  makeEmbedFileLoaders
} from './embed/defaults';
import { isStencilAssetUrl, resolveStencilAssetUrl } from './stencilUrl';

const random = new Random(Date.now());

// Stencil packs whose asset URLs resolve against this (see embedStencilConfig in
// embed/defaults.ts) — kept separate from the `/api/fs/` remote-filesystem routing below,
// since these are static assets, not project files.
const stencilRoot = import.meta.env.VITE_STENCIL_ROOT ?? '';

if (!window.electronAPI) {
  FileSystem.loadFromUrl = async (url: string) => {
    let resolvedUrl: string;
    if (isStencilAssetUrl(url, stencilRoot)) {
      resolvedUrl = resolveStencilAssetUrl(url, stencilRoot);
    } else {
      const fsConfig = AppConfig.get().filesystem;
      resolvedUrl = fsConfig.provider === 'remote' ? `${fsConfig.endpoint}/api/fs/${url}` : url;
    }
    const response = await fetch(resolvedUrl);
    if (!response.ok) {
      throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`);
    }
    return response.text();
  };
}

export const defaultAppConfig: AppConfig = {
  elementDefinitions: {
    registry: embedElementDefinitions
  },
  stencils: {
    loaders: embedStencilLoaders,
    registry: embedStencilConfig({ stencilRoot })
  },
  file: {
    loaders: makeEmbedFileLoaders(() =>
      defaultAppConfig.stencils.registry
        .filter(entry => entry.includedByDefault)
        .map(entry => entry.id)
    )
  },
  state: {
    store: true,
    key: () => 'diagram-craft.user-state'
  },
  awareness: {
    name: () =>
      (navigator.userAgent.includes('Edg') ? 'Edge' : 'Chrome') +
      ' ' +
      Math.floor(random.nextRange(0, 1000)),
    color: () => random.pick(['red', 'green', 'blue', 'orange']),
    avatar: () => undefined
  },
  collaboration: {
    forceClearServerState: () => false,
    forceLoadFromServer: () => false,
    backend: import.meta.env.VITE_CRDT_BACKEND === 'yjs-websocket' ? 'yjs' : 'noop',
    config: {
      url: import.meta.env.VITE_CRDT_BACKEND_YJS_URL
    }
  },
  autosave: window.electronAPI ? ElectronAutosave : MultiWindowAutosave,
  filesystem: {
    provider: import.meta.env.VITE_FS_PROVIDER ?? 'remote',
    endpoint: import.meta.env.VITE_FS_ENDPOINT ?? ''
  },
  ai: {
    provider: import.meta.env.VITE_AI_PROVIDER ?? 'none',
    endpoint: import.meta.env.VITE_AI_ENDPOINT ?? ''
  }
};
