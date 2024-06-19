import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppLoader, StencilRegistryConfig } from './AppLoader';
import './index.css';
import { deserializeDiagramDocument } from '@diagram-craft/model/serialization/deserialize';
import { snapTestDiagram } from './sample/snap-test';
import { testDiagram } from './sample/test';
import { SerializedDiagram } from '@diagram-craft/model/serialization/types';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { Diagram } from '@diagram-craft/model/diagram';
import {
  defaultEdgeRegistry,
  defaultNodeRegistry
} from '@diagram-craft/canvas-app/defaultRegistry';
import { drawioReader } from '@diagram-craft/canvas-drawio/drawioReader';
import { registerDrawioBaseNodeTypes } from '@diagram-craft/canvas-drawio/register';
import { simpleDiagram } from './sample/simple';

const stencilRegistry: StencilRegistryConfig = [
  {
    type: 'drawioManual',
    callback: import('@diagram-craft/canvas-drawio/shapes/uml').then(
      ({ registerUMLShapes }) => registerUMLShapes
    )
  },
  {
    name: 'GCP',
    type: 'drawioXml',
    url: '/stencils/gcp2.xml',
    foreground: '#3b8df1',
    background: '#3b8df1'
  },
  {
    name: 'AWS',
    type: 'drawioXml',
    url: '/stencils/aws3.xml',
    foreground: '#ff9900',
    background: '#ff9900'
  },
  {
    name: 'Azure',
    type: 'drawioXml',
    url: '/stencils/azure.xml',
    foreground: '#00abf0',
    background: '#00abf0'
  },
  {
    name: 'Fluid Power',
    type: 'drawioXml',
    url: '/stencils/fluid_power.xml',
    foreground: 'var(--canvas-fg)',
    background: 'var(--canvas-fg)'
  },
  {
    name: 'IBM',
    type: 'drawioXml',
    url: '/stencils/ibm.xml',
    foreground: 'var(--canvas-fg)',
    background: 'transparent'
  },
  {
    name: 'Web Logos',
    type: 'drawioXml',
    url: '/stencils/weblogos.xml',
    foreground: 'blue',
    background: '#ffffff'
  },
  {
    name: 'Web Icons',
    type: 'drawioXml',
    url: '/stencils/webicons.xml',
    foreground: 'blue',
    background: '#000000'
  },
  {
    name: 'EIP',
    type: 'drawioXml',
    url: '/stencils/eip.xml',
    foreground: 'black',
    background: '#c0f5a9'
  },
  {
    name: 'Arrows',
    type: 'drawioXml',
    url: '/stencils/arrows.xml',
    foreground: 'var(--canvas-fg)',
    background: 'transparent'
  },
  {
    name: 'Basic',
    type: 'drawioXml',
    url: '/stencils/basic.xml',
    foreground: 'var(--canvas-fg)',
    background: 'transparent'
  }
];

const nodeRegistry = defaultNodeRegistry();
registerDrawioBaseNodeTypes(nodeRegistry);

const edgeRegistry = defaultEdgeRegistry();

const diagramFactory = (d: SerializedDiagram, doc: DiagramDocument) => {
  return new Diagram(d.id, d.name, doc);
};

const documentFactory = () => {
  return new DiagramDocument(nodeRegistry, edgeRegistry);
};

const diagrams = [
  {
    name: 'Simple',
    document: () => deserializeDiagramDocument(simpleDiagram, documentFactory, diagramFactory)
  },
  {
    name: 'Drawio',
    document: async () => {
      const res = await fetch(
        location.hash !== '' ? location.hash.slice(1) : '/diagrams/uml.drawio'
      );
      const text = await res.text();

      const doc = drawioReader(text, documentFactory, diagramFactory);
      return await doc;
    }
  },
  {
    name: 'Snap test',
    document: () => deserializeDiagramDocument(snapTestDiagram, documentFactory, diagramFactory)
  },
  {
    name: 'Test',
    document: () => deserializeDiagramDocument(testDiagram, documentFactory, diagramFactory)
  }
];

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppLoader
      stencils={stencilRegistry}
      diagram={diagrams[0]}
      recent={diagrams}
      diagramFactory={diagramFactory}
      documentFactory={documentFactory}
      nodeRegistry={nodeRegistry}
    />
  </React.StrictMode>
);
