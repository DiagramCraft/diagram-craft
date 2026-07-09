import { deserializeDiagramDocument } from '@diagram-craft/model/serialization/deserialize';
import { stencilLoaderBasic } from '@diagram-craft/model/stencilRegistry';
import type { TextHandlers } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import { markdownToHTML, htmlStringToMarkdown } from '@diagram-craft/markdown';
import { stencilEntry } from '../appConfig';
import type { ElementDefinitionRegistryConfig, StencilRegistryConfig } from '../appConfig';
import type { Autosave } from '../react-app/autosave/Autosave';
import type { fileLoaderRegistry } from '@diagram-craft/canvas-app/loaders';

/**
 * Env-free shared fragments used to build both the standalone default config
 * (appConfig.default.ts) and the embedding facade (embed/createDiagramCraft.ts).
 * Must not touch import.meta.env or window.electronAPI.
 */

export const noopAutosave: Autosave = {
  load: async () => undefined,
  save: async () => {},
  asyncSave: () => {},
  exists: async () => false,
  clear: () => {},
  init: () => {}
};

export const markdownTextHandlers: TextHandlers = {
  format: 'Markdown',
  dialog: {
    editToStored: (s: string) => markdownToHTML(s, 'extended'),
    storedToEdit: (s: string) => htmlStringToMarkdown(s),
    storedToHTML: (s: string) => s
  }
};

export const embedElementDefinitions: ElementDefinitionRegistryConfig = [
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

export const embedStencilConfig: StencilRegistryConfig = [
  stencilEntry({
    id: 'default',
    name: 'Basic shapes',
    description: 'Rectangles, ellipses, lines and connectors',
    icon: 'TbShape',
    group: 'General',
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
    description: 'Directional arrows and flow markers',
    icon: 'TbArrowRight',
    group: 'General',
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
    description: 'Business process model & notation',
    icon: 'TbBinaryTree',
    group: 'Modelling',
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
    description: 'Class, sequence, activity and state diagrams',
    icon: 'TbBox',
    group: 'Modelling',
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
    description: 'Entities, relationships and tables',
    icon: 'TbDatabase',
    group: 'Modelling',
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
    description: 'Context, container and component views',
    icon: 'TbStack2',
    group: 'Modelling',
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
    description: 'Enterprise architecture notation',
    icon: 'TbNetwork',
    group: 'Modelling',
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

export const embedStencilLoaders = {
  basic: () => Promise.resolve(stencilLoaderBasic)
};

/**
 * `.json`/`.dcd` file loaders, parameterized by a lazily-evaluated list of the
 * currently-included stencil packages (so callers can pass their own stencil config).
 */
export const makeJsonFileLoaders = (
  getIncludedPackages: () => string[]
): Pick<typeof fileLoaderRegistry, '.json' | '.dcd'> => ({
  '.json': async () => (content, doc, diagramFactory) =>
    deserializeDiagramDocument(JSON.parse(content), doc, diagramFactory, {
      includedPackages: getIncludedPackages()
    }),
  '.dcd': async () => (content, doc, diagramFactory) =>
    deserializeDiagramDocument(JSON.parse(content), doc, diagramFactory, {
      includedPackages: getIncludedPackages()
    })
});
