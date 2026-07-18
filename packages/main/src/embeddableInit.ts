import { defaultRegistry } from '@diagram-craft/canvas-app/defaultRegistry';
import { registerDrawioBaseNodeTypes } from '@diagram-craft/canvas-drawio/register';
import { registerDefaultEffects } from '@diagram-craft/canvas/effects/effects';
import {
  makeDefaultDiagramFactory,
  makeDefaultDocumentFactory
} from '@diagram-craft/model/diagramDocumentFactory';
import type { DocumentFactory, DiagramFactory } from '@diagram-craft/model/diagramDocumentFactory';
import type { NodeDefinitionRegistry } from '@diagram-craft/model/nodeDefinitionRegistry';
import { stencilLoaderBasic, stencilLoaderRegistry } from '@diagram-craft/model/stencilRegistry';
import { fileLoaderRegistry } from '@diagram-craft/canvas-app/loaders';
import { deserializeDiagramDocument } from '@diagram-craft/model/serialization/deserialize';
import { AppConfig, stencilEntry } from './appConfig';
import type { StencilRegistryConfig } from './appConfig';
import { Autosave } from './react-app/autosave/Autosave';
import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import { markdownToHTML, htmlStringToMarkdown } from '@diagram-craft/markdown';

let initialized = false;
let _documentFactory: DocumentFactory;
let _diagramFactory: DiagramFactory;
let _nodeRegistry: NodeDefinitionRegistry;
let _stencilConfig: StencilRegistryConfig;

const LAZY_LOADERS = [
  {
    shapes: /^(bpmn[A-Z][a-zA-Z]+)$/,
    nodeDefinitionLoader: () =>
      import('@diagram-craft/stencil-bpmn/stencil-bpmn-loader').then(m => m.registerBPMNNodes),
    edgeDefinitionLoader: () =>
      import('@diagram-craft/stencil-bpmn/stencil-bpmn-loader').then(m => m.registerBPMNEdges)
  },
  {
    shapes: /^(dataModelling[A-Z][a-zA-Z0-9]+)$/,
    nodeDefinitionLoader: () =>
      import('@diagram-craft/stencil-data-modelling/stencil-data-modelling-loader').then(
        m => m.registerDataModellingNodes
      ),
    edgeDefinitionLoader: () =>
      import('@diagram-craft/stencil-data-modelling/stencil-data-modelling-loader').then(
        m => m.registerDataModellingEdges
      )
  },
  {
    shapes: /^(c4[A-Z][a-zA-Z0-9]+)$/,
    nodeDefinitionLoader: () =>
      import('@diagram-craft/stencil-c4/stencil-c4-loader').then(m => m.registerC4Nodes)
  },
  {
    shapes: /^(uml[A-Z][a-zA-Z0-9]+)$/,
    nodeDefinitionLoader: () =>
      import('@diagram-craft/stencil-uml/stencil-uml-loader').then(m => m.registerUMLNodes)
  }
];

const noopAutosave = {
  load: async () => undefined,
  save: async () => {},
  asyncSave: () => {},
  exists: async () => false,
  clear: () => {},
  init: () => {}
};

export const embeddableInit = () => {
  if (initialized)
    return {
      documentFactory: _documentFactory,
      diagramFactory: _diagramFactory,
      nodeRegistry: _nodeRegistry,
      stencilConfig: _stencilConfig
    };

  // Set up AppConfig for embedded use
  _stencilConfig = [
    stencilEntry({
      id: 'default',
      name: 'Basic shapes',
      includedByDefault: true,
      loader: 'basic',
      opts: {
        stencils: () =>
          Promise.resolve(async registry => {
            return registry.stencils.get('default');
          })
      }
    }),
    stencilEntry({
      id: 'arrow',
      name: 'Arrow',
      includedByDefault: true,
      loader: 'basic',
      opts: {
        stencils: () =>
          Promise.resolve(async registry => {
            return registry.stencils.get('arrow');
          })
      }
    }),
    stencilEntry({
      id: 'bpmn2',
      name: 'BPMN 2.0',
      includedByDefault: true,
      loader: 'basic',
      opts: {
        stencils: () =>
          import('@diagram-craft/stencil-bpmn/stencil-bpmn-loader').then(m => m.loadBPMNStencils)
      }
    }),
    stencilEntry({
      id: 'uml',
      name: 'UML',
      includedByDefault: true,
      loader: 'basic',
      opts: {
        stencils: () =>
          import('@diagram-craft/stencil-uml/stencil-uml-loader').then(m => m.loadUMLStencils)
      }
    }),
    stencilEntry({
      id: 'data-modelling',
      name: 'Data Modelling',
      includedByDefault: true,
      loader: 'basic',
      opts: {
        stencils: () =>
          import('@diagram-craft/stencil-data-modelling/stencil-data-modelling-loader').then(
            m => m.loadDataModellingStencils
          )
      }
    }),
    stencilEntry({
      id: 'c4',
      name: 'C4',
      includedByDefault: true,
      loader: 'basic',
      opts: {
        stencils: () =>
          import('@diagram-craft/stencil-c4/stencil-c4-loader').then(m => m.loadC4Stencils)
      }
    }),
    stencilEntry({
      id: 'archimate',
      name: 'ArchiMate',
      includedByDefault: true,
      loader: 'basic',
      opts: {
        stencils: () =>
          import('@diagram-craft/stencil-archimate/stencil-archimate-loader').then(
            m => m.loadArchimateStencils
          )
      }
    })
  ];

  const includedPackages = _stencilConfig.filter(e => e.includedByDefault).map(e => e.id);

  AppConfig.set({
    state: { store: true, key: () => 'diagram-craft.user-state' },
    awareness: {
      name: () => 'User',
      color: () => '#3b82f6',
      avatar: () => undefined
    },
    collaboration: {
      backend: 'noop',
      forceLoadFromServer: () => false,
      forceClearServerState: () => false
    },
    elementDefinitions: { registry: LAZY_LOADERS },
    stencils: {
      loaders: { basic: () => Promise.resolve(stencilLoaderBasic) },
      registry: _stencilConfig
    },
    file: {
      loaders: {
        '.json': async () => (content, doc, diagramFactory) =>
          deserializeDiagramDocument(JSON.parse(content), doc, diagramFactory, {
            includedPackages
          }),
        '.dcd': async () => (content, doc, diagramFactory) =>
          deserializeDiagramDocument(JSON.parse(content), doc, diagramFactory, {
            includedPackages
          })
      }
    },
    autosave: noopAutosave,
    filesystem: { provider: 'none', endpoint: '' },
    ai: { provider: 'none' }
  });

  // Register stencil loaders
  stencilLoaderRegistry['basic'] = () => Promise.resolve(stencilLoaderBasic);

  // Register file loaders
  for (const [k, v] of Object.entries(AppConfig.get().file.loaders)) {
    fileLoaderRegistry[k] = v;
  }

  // Initialize autosave (noop)
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

  // Create registries
  const { nodes, edges, stencils } = defaultRegistry(LAZY_LOADERS);
  registerDrawioBaseNodeTypes(nodes);
  registerDefaultEffects();

  _diagramFactory = makeDefaultDiagramFactory();
  _documentFactory = makeDefaultDocumentFactory({ nodes, edges, stencils });
  _nodeRegistry = nodes;

  initialized = true;

  return {
    documentFactory: _documentFactory,
    diagramFactory: _diagramFactory,
    nodeRegistry: _nodeRegistry,
    stencilConfig: _stencilConfig
  };
};

export const getIncludedPackages = () =>
  (_stencilConfig ?? []).filter(e => e.includedByDefault).map(e => e.id);
