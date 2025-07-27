import { fileLoaderRegistry, type stencilLoaderRegistry } from '@diagram-craft/canvas-app/loaders';
import { assert } from '@diagram-craft/utils/assert';

export type AppConfig = {
  state: {
    store: boolean;
    key: () => string;
  };
  awareness: {
    name: () => string;
    color: () => string;
    avatar: () => string | undefined;
  };
  collaboration: {
    forceLoadFromServer: () => boolean;
    forceClearServerState: () => boolean;
  } & (
    | {
        backend: 'noop';
      }
    | {
        backend: 'yjs';
        config: {
          url: string;
        };
      }
  );
  stencils: {
    loaders: typeof stencilLoaderRegistry;
    registry: StencilRegistryConfig;
  };
  file: {
    loaders: typeof fileLoaderRegistry;
  };
};

type StencilRegistryConfigEntry<K extends keyof StencilLoaderOpts> = {
  type: K;
  shapes?: RegExp;
  opts: StencilLoaderOpts[K];
};

export type StencilRegistryConfig = Array<StencilRegistryConfigEntry<keyof StencilLoaderOpts>>;

let CONFIG_IN_USE: AppConfig | undefined = undefined;

export const AppConfig = {
  get(): AppConfig {
    assert.present(CONFIG_IN_USE);
    return CONFIG_IN_USE;
  },
  set(config: AppConfig) {
    CONFIG_IN_USE = config;
  }
};

export const defineAppConfig = (fn: (defaultConfig: AppConfig) => AppConfig) => {
  return fn;
};
