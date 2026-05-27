import { defaultRegistry } from '@diagram-craft/canvas-app/defaultRegistry';
import { registerDrawioBaseNodeTypes } from '@diagram-craft/canvas-drawio/register';
import { registerDefaultEffects } from '@diagram-craft/canvas/effects/effects';
import {
  makeDefaultDiagramFactory,
  makeDefaultDocumentFactory
} from '@diagram-craft/model/diagramDocumentFactory';
import type { DocumentFactory, DiagramFactory } from '@diagram-craft/model/diagramDocumentFactory';
import type { NodeDefinitionRegistry } from '@diagram-craft/model/elementDefinitionRegistry';
import { stencilLoaderBasic, stencilLoaderRegistry } from '@diagram-craft/model/stencilRegistry';
let initialized = false;

let _documentFactory: DocumentFactory;
let _diagramFactory: DiagramFactory;
let _nodeRegistry: NodeDefinitionRegistry;

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
  },
];

export const STENCIL_CONFIG = [
  { id: 'default', name: 'Basic shapes', includedByDefault: true },
  { id: 'arrow', name: 'Arrow', includedByDefault: true },
  { id: 'bpmn2', name: 'BPMN 2.0', includedByDefault: true },
  { id: 'uml', name: 'UML', includedByDefault: true },
  { id: 'data-modelling', name: 'Data Modelling', includedByDefault: true },
  { id: 'c4', name: 'C4', includedByDefault: true },
  { id: 'archimate', name: 'ArchiMate', includedByDefault: true }
];

export const INCLUDED_PACKAGES = STENCIL_CONFIG.filter(e => e.includedByDefault).map(e => e.id);

export const initDiagramCraft = () => {
  if (initialized) return { documentFactory: _documentFactory, diagramFactory: _diagramFactory, nodeRegistry: _nodeRegistry };

  const { nodes, edges, stencils } = defaultRegistry(LAZY_LOADERS);

  registerDrawioBaseNodeTypes(nodes);
  registerDefaultEffects();

  // Register stencil loaders
  stencilLoaderRegistry['basic'] = () => Promise.resolve(stencilLoaderBasic);

  _diagramFactory = makeDefaultDiagramFactory();
  _documentFactory = makeDefaultDocumentFactory({ nodes, edges, stencils });
  _nodeRegistry = nodes;

  initialized = true;

  return { documentFactory: _documentFactory, diagramFactory: _diagramFactory, nodeRegistry: _nodeRegistry };
};
