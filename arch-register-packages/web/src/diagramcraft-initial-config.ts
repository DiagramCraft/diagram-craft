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
import { AppConfig } from '@diagram-craft/main/appConfig';
import { defaultAppConfig } from '@diagram-craft/main/appConfig.default';
import { Autosave } from '@diagram-craft/main/react-app/autosave/Autosave';
import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import { markdownToHTML, htmlStringToMarkdown } from '@diagram-craft/markdown';
import { CollaborationConfig } from '@diagram-craft/collaboration/collaborationConfig';
import { YJSRoot, YJSMap } from '@diagram-craft/collaboration/yjs/yjsCrdt';
import { YJSWebSocketCollaborationBackend } from '@diagram-craft/collaboration/yjs/yjsWebsocketCollaborationBackend';

const noopAutosave = {
  load: async () => undefined,
  save: async () => {},
  asyncSave: () => {},
  exists: async () => false,
  clear: () => {},
  init: () => {}
};

let initialized = false;
let _currentWorkspaceId: string | undefined;
let _documentFactory: DocumentFactory;
let _diagramFactory: DiagramFactory;
let _nodeRegistry: NodeDefinitionRegistry;
let _registry: Registry;

const initializeDiagramCraft = (workspaceId: string) => {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${window.location.host}/ws`;

  if (workspaceId !== _currentWorkspaceId) {
    AppConfig.set({
      ...defaultAppConfig,
      collaboration: {
        backend: 'yjs',
        config: { url: wsUrl },
        forceLoadFromServer: () => false,
        forceClearServerState: () => false
      },
      autosave: noopAutosave,
      filesystem: { provider: 'none', endpoint: '' },
      ai: { provider: 'remote', endpoint: `/api/${workspaceId}` }
    });

    _currentWorkspaceId = workspaceId;
  }

  if (initialized) {
    return {
      documentFactory: _documentFactory,
      diagramFactory: _diagramFactory,
      nodeRegistry: _nodeRegistry,
      registry: _registry,
      includedPackages: getIncludedPackages()
    };
  }

  // Initialize YJS collaboration backend
  CollaborationConfig.isNoOp = false;
  CollaborationConfig.CRDTRoot = YJSRoot;
  CollaborationConfig.CRDTMap = YJSMap;
  CollaborationConfig.Backend = new YJSWebSocketCollaborationBackend(wsUrl);

  // Register stencil loaders from default config
  for (const [k, v] of Object.entries(defaultAppConfig.stencils.loaders)) {
    // @ts-expect-error
    stencilLoaderRegistry[k] = v;
  }

  // Register file loaders from default config
  for (const [k, v] of Object.entries(defaultAppConfig.file.loaders)) {
    fileLoaderRegistry[k] = v;
  }

  // Initialize autosave (noop for arch-register)
  Autosave.init(noopAutosave);

  // Set up markdown text handlers
  ShapeNodeDefinition.DEFAULT_TEXT_HANDLERS = {
    format: 'Markdown',
    dialog: {
      editToStored: (s: string) => markdownToHTML(s, 'extended'),
      storedToEdit: (s: string) => htmlStringToMarkdown(s),
      storedToHTML: (s: string) => s
    }
  };

  // Create registries using the lazy loaders from default config
  const { nodes, edges, stencils } = defaultRegistry(defaultAppConfig.elementDefinitions.registry);
  registerDrawioBaseNodeTypes(nodes);
  registerDefaultEffects();

  _diagramFactory = makeDefaultDiagramFactory();
  _documentFactory = makeDefaultDocumentFactory({ nodes, edges, stencils });
  _nodeRegistry = nodes;
  _registry = { nodes, edges, stencils };

  initialized = true;

  return {
    documentFactory: _documentFactory,
    diagramFactory: _diagramFactory,
    nodeRegistry: _nodeRegistry,
    registry: _registry,
    includedPackages: getIncludedPackages()
  };
};

export const getIncludedPackages = () =>
  defaultAppConfig.stencils.registry.filter(e => e.includedByDefault).map(e => e.id);

export { initializeDiagramCraft };