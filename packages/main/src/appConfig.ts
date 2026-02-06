import { fileLoaderRegistry } from '@diagram-craft/canvas-app/loaders';
import { assert } from '@diagram-craft/utils/assert';
import type { Autosave } from './react-app/autosave/Autosave';
import { LazyElementLoaderEntry } from '@diagram-craft/model/elementDefinitionRegistry';
import { StencilLoaderOpts, stencilLoaderRegistry } from '@diagram-craft/model/stencilRegistry';

/**
 * Main application configuration type that defines all configurable aspects of the application.
 */
export type AppConfig = {
  /**
   * Configuration for application state persistence.
   */
  state: {
    /**
     * Whether to store application state between sessions.
     * When true, the application will save state to localStorage or other storage mechanism.
     */
    store: boolean;

    /**
     * Function that returns the storage key used for persisting application state.
     * This key is used to identify the stored data in localStorage or other storage mechanisms.
     */
    key: () => string;
  };

  /**
   * Configuration for user awareness in collaborative editing.
   * These settings control how a user appears to others in collaborative sessions.
   */
  awareness: {
    /**
     * Function that returns the display name of the current user in collaborative sessions.
     */
    name: () => string;

    /**
     * Function that returns the color associated with the current user in collaborative sessions.
     * This color is used to highlight user's cursor, selections, and other interactive elements.
     */
    color: () => string;

    /**
     * Function that returns the avatar URL for the current user, if available.
     * Returns undefined if no avatar is set.
     */
    avatar: () => string | undefined;
  };

  /**
   * Configuration for real-time collaboration features.
   * Defines the collaboration backend and related settings.
   */
  collaboration: {
    /**
     * When true, forces the application to load the document state from the server
     * even if there is local state available.
     */
    forceLoadFromServer: () => boolean;

    /**
     * When true, forces the application to clear any existing server state
     * before initializing a new collaborative session.
     */
    forceClearServerState: () => boolean;
  } & (
    | {
        /**
         * No-operation backend that doesn't provide real collaboration.
         * Used for single-user mode or when collaboration is disabled.
         */
        backend: 'noop';
      }
    | {
        /**
         * YJS-based collaboration backend for real-time collaborative editing.
         */
        backend: 'yjs';

        /**
         * Configuration specific to the YJS collaboration backend.
         */
        config: {
          /**
           * WebSocket URL for the YJS collaboration server.
           */
          url: string;
        };
      }
  );

  elementDefinitions: {
    registry: ElementDefinitionRegistryConfig;
  };

  /**
   * Configuration for diagram stencils (shapes and templates).
   */
  stencils: {
    /**
     * Registry of stencil loaders that can load stencils from various sources.
     */
    loaders: typeof stencilLoaderRegistry;

    /**
     * Configuration for the stencil registry, defining which stencils are available
     * and how they are loaded.
     */
    registry: StencilRegistryConfig;
  };

  /**
   * Configuration for file operations.
   */
  file: {
    /**
     * Registry of file loaders that can load and save files in various formats.
     */
    loaders: typeof fileLoaderRegistry;
  };

  /**
   * Which Autosave implementation to use
   */
  autosave: Autosave;

  filesystem: {
    provider: 'none' | 'remote' | 'local';
    endpoint: string;
  };

  ai: {
    provider: 'none' | 'remote';
    endpoint?: string;
  };
};

type StencilRegistryConfigEntry<K extends keyof StencilLoaderOpts> = {
  loader: K;
  id: string;
  name: string;
  opts: StencilLoaderOpts[K];
};

export type StencilRegistryConfig = Array<StencilRegistryConfigEntry<keyof StencilLoaderOpts>>;

type ElementDefinitionRegistryConfigEntry = LazyElementLoaderEntry;

export type ElementDefinitionRegistryConfig = Array<ElementDefinitionRegistryConfigEntry>;

let CONFIG_IN_USE: AppConfig | undefined;

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
