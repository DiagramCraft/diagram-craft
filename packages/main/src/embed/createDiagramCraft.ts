import { defaultRegistry } from '@diagram-craft/canvas-app/defaultRegistry';
import { registerDrawioBaseNodeTypes } from '@diagram-craft/canvas-drawio/register';
import { registerDefaultEffects } from '@diagram-craft/canvas/effects/effects';
import {
  makeDefaultDiagramFactory,
  makeDefaultDocumentFactory
} from '@diagram-craft/model/diagramDocumentFactory';
import type { DocumentFactory, DiagramFactory } from '@diagram-craft/model/diagramDocumentFactory';
import type { NodeDefinitionRegistry, Registry } from '@diagram-craft/model/elementDefinitionRegistry';
import { stencilLoaderRegistry } from '@diagram-craft/model/stencilRegistry';
import { fileLoaderRegistry } from '@diagram-craft/canvas-app/loaders';
import { AppConfig } from '../appConfig';
import type { StencilRegistryConfig } from '../appConfig';
import { Autosave } from '../react-app/autosave/Autosave';
import type { Autosave as AutosaveType } from '../react-app/autosave/Autosave';
import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import type { TextHandlers } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import { CollaborationConfig } from '@diagram-craft/collaboration/collaborationConfig';
import { YJSMap, YJSRoot } from '@diagram-craft/collaboration/yjs/yjsCrdt';
import { YJSWebSocketCollaborationBackend } from '@diagram-craft/collaboration/yjs/yjsWebsocketCollaborationBackend';
import { deepEquals } from '@diagram-craft/utils/object';
import {
  embedElementDefinitions,
  embedStencilConfig,
  embedStencilLoaders,
  makeJsonFileLoaders,
  markdownTextHandlers,
  noopAutosave
} from './defaults';

export type DiagramCraftConfig = {
  collaboration?: { backend: 'noop' } | { backend: 'yjs'; url: string };
  autosave?: AutosaveType;
  awareness?: AppConfig['awareness'];
  ai?: AppConfig['ai'];
  filesystem?: AppConfig['filesystem'];
  stencils?: StencilRegistryConfig;
  fileLoaders?: AppConfig['file']['loaders'];
  elementDefinitions?: AppConfig['elementDefinitions']['registry'];
  textHandlers?: TextHandlers | false;
};

/** Standalone escape hatch: pass a fully-built AppConfig (e.g. appConfig.default.ts) as-is. */
export type DiagramCraftConfigInput =
  | DiagramCraftConfig
  | { appConfig: AppConfig; textHandlers?: TextHandlers | false };

export type DiagramCraftInstance = {
  documentFactory: DocumentFactory;
  diagramFactory: DiagramFactory;
  registry: Registry;
  nodeRegistry: NodeDefinitionRegistry;
  includedPackages: string[];
  stencilConfig: StencilRegistryConfig;
  updateConfig: (patch: Partial<Pick<AppConfig, 'ai' | 'awareness' | 'filesystem'>>) => void;
};

const isFullAppConfigInput = (
  input: DiagramCraftConfigInput
): input is { appConfig: AppConfig; textHandlers?: TextHandlers | false } => 'appConfig' in input;

// Fields compared for idempotence — everything else routes through updateConfig
// and is expected to legitimately vary between calls (e.g. arch-register's `ai.endpoint`
// changing on workspace switch), so it is intentionally excluded from this check.
type ImmutableConfigFields = Pick<
  DiagramCraftConfig,
  'collaboration' | 'autosave' | 'stencils' | 'fileLoaders' | 'elementDefinitions' | 'textHandlers'
>;

const pickImmutableFields = (config: DiagramCraftConfig): ImmutableConfigFields => ({
  collaboration: config.collaboration,
  autosave: config.autosave,
  stencils: config.stencils,
  fileLoaders: config.fileLoaders,
  elementDefinitions: config.elementDefinitions,
  textHandlers: config.textHandlers
});

const buildAppConfig = (config: DiagramCraftConfig): AppConfig => {
  const stencilConfig = config.stencils ?? embedStencilConfig;
  const includedPackages = stencilConfig.filter(e => e.includedByDefault).map(e => e.id);

  return {
    state: { store: false, key: () => 'diagram-craft.user-state' },
    awareness: config.awareness ?? {
      name: () => 'User',
      color: () => '#3b82f6',
      avatar: () => undefined
    },
    collaboration:
      config.collaboration?.backend === 'yjs'
        ? {
            backend: 'yjs',
            config: { url: config.collaboration.url },
            forceLoadFromServer: () => false,
            forceClearServerState: () => false
          }
        : {
            backend: 'noop',
            forceLoadFromServer: () => false,
            forceClearServerState: () => false
          },
    elementDefinitions: { registry: config.elementDefinitions ?? embedElementDefinitions },
    stencils: {
      loaders: embedStencilLoaders,
      registry: stencilConfig
    },
    file: {
      loaders: config.fileLoaders ?? makeJsonFileLoaders(() => includedPackages)
    },
    autosave: config.autosave ?? noopAutosave,
    filesystem: config.filesystem ?? { provider: 'none', endpoint: '' },
    ai: config.ai ?? { provider: 'none' }
  };
};

let initialized = false;
let _lastImmutableFields: ImmutableConfigFields | 'full-app-config' | undefined;
let _instance: DiagramCraftInstance;

const finishInit = (appConfig: AppConfig, textHandlers: TextHandlers | false | undefined): void => {
  AppConfig.set(appConfig);

  if (appConfig.collaboration.backend === 'yjs') {
    CollaborationConfig.isNoOp = false;
    CollaborationConfig.CRDTRoot = YJSRoot;
    CollaborationConfig.CRDTMap = YJSMap;
    CollaborationConfig.Backend = new YJSWebSocketCollaborationBackend(
      appConfig.collaboration.config.url
    );
  }

  for (const [k, v] of Object.entries(appConfig.file.loaders)) {
    fileLoaderRegistry[k] = v;
  }

  for (const [k, v] of Object.entries(appConfig.stencils.loaders)) {
    // biome-ignore lint/suspicious/noExplicitAny: stencilLoaderRegistry keys are keyed by loader-opts union
    stencilLoaderRegistry[k as keyof typeof stencilLoaderRegistry] = v as any;
  }

  Autosave.init(appConfig.autosave);

  if (textHandlers !== false) {
    ShapeNodeDefinition.DEFAULT_TEXT_HANDLERS = textHandlers ?? markdownTextHandlers;
  }

  const { nodes, edges, stencils } = defaultRegistry(appConfig.elementDefinitions.registry);
  registerDrawioBaseNodeTypes(nodes);
  registerDefaultEffects();

  const diagramFactory = makeDefaultDiagramFactory();
  const documentFactory = makeDefaultDocumentFactory({ nodes, edges, stencils });

  _instance = {
    documentFactory,
    diagramFactory,
    registry: { nodes, edges, stencils },
    nodeRegistry: nodes,
    includedPackages: appConfig.stencils.registry.filter(e => e.includedByDefault).map(e => e.id),
    stencilConfig: appConfig.stencils.registry,
    updateConfig: patch => {
      AppConfig.set({ ...AppConfig.get(), ...patch });
    }
  };

  initialized = true;
};

/**
 * Init facade for embedding diagram-craft into a host application. Builds and installs
 * the module-scope AppConfig/CollaborationConfig/Autosave/loader-registry globals from a
 * typed config, and returns the factories/registries needed to render EmbeddableEditor.
 *
 * Only one editor config is supported per page — a second call with different
 * `collaboration`/`autosave`/`stencils`/`fileLoaders`/`elementDefinitions`/`textHandlers`
 * throws, since AppConfig.set() would otherwise silently clobber config out from under
 * already-mounted React trees. `ai`/`awareness`/`filesystem` may legitimately change
 * between calls (e.g. on workspace switch) — use `updateConfig` for those.
 *
 * Pass `{ appConfig }` to install a fully-built AppConfig as-is (the standalone path,
 * which keeps appConfig.default.ts + the `@diagram-craft/config` vite-alias mechanism).
 */
export const createDiagramCraft = (config: DiagramCraftConfigInput = {}): DiagramCraftInstance => {
  if (isFullAppConfigInput(config)) {
    if (initialized) {
      if (_lastImmutableFields !== 'full-app-config') {
        throw new Error(
          'createDiagramCraft({ appConfig }) was called after createDiagramCraft() had already ' +
            'been initialized with a shorthand config. Only one editor config is supported per page.'
        );
      }
      return _instance;
    }
    finishInit(config.appConfig, config.textHandlers);
    _lastImmutableFields = 'full-app-config';
    return _instance;
  }

  const immutableFields = pickImmutableFields(config);

  if (initialized) {
    if (
      _lastImmutableFields === 'full-app-config' ||
      !deepEquals(immutableFields, _lastImmutableFields)
    ) {
      throw new Error(
        'createDiagramCraft() was called again with a different collaboration/autosave/' +
          'stencils/fileLoaders/elementDefinitions/textHandlers config. Only one editor ' +
          'config is supported per page — use updateConfig() to change ai/awareness/filesystem.'
      );
    }
    return _instance;
  }

  finishInit(buildAppConfig(config), config.textHandlers);
  _lastImmutableFields = immutableFields;

  return _instance;
};
