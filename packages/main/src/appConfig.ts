import { fileLoaderRegistry, type stencilLoaderRegistry } from '@diagram-craft/canvas-app/loaders';
import type { EmptyObject } from '@diagram-craft/utils/types';

type CollaborationConfig<B extends keyof CollaborationBackendConfig> = {
  backend?: B;
  forceLoadFromServer?: () => boolean;
  forceClearServerState?: () => boolean;
  config?: CollaborationBackendConfig[B];
};

export type AppConfig = {
  state?: {
    store?: boolean;
    key?: () => string;
  };
  awareness?: {
    name?: () => string;
    color?: () => string;
    avatar?: () => string;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  collaboration?: CollaborationConfig<any>;
  stencils?: {
    loaders?: typeof stencilLoaderRegistry;
    registry?: StencilRegistryConfig;
  };
  file?: {
    loaders?: typeof fileLoaderRegistry;
  };
};

declare global {
  interface CollaborationBackendConfig {
    noop: EmptyObject;
    yjs: {
      url: string;
    };
  }
}

type StencilRegistryConfigEntry<K extends keyof StencilLoaderOpts> = {
  type: K;
  shapes?: RegExp;
  opts: StencilLoaderOpts[K];
};

export type StencilRegistryConfig = Array<StencilRegistryConfigEntry<keyof StencilLoaderOpts>>;

let CONFIG_IN_USE: AppConfig = {};

export const AppConfig = {
  get(): AppConfig {
    return CONFIG_IN_USE;
  },
  set(config: AppConfig) {
    CONFIG_IN_USE = config;
  }
};

export const defineAppConfig = (fn: (defaultConfig: AppConfig) => AppConfig) => {
  return fn;
};
