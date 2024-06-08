import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppLoader } from './AppLoader';
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
import { drawioReader } from '@diagram-craft/canvas-app/drawio/drawioReader';

const stencilRegistry = [
  {
    name: 'GCP',
    url: '/stencils/gcp2.xml',
    foreground: '#3b8df1',
    background: '#3b8df1'
  },
  {
    name: 'AWS',
    url: '/stencils/aws3.xml',
    foreground: '#ff9900',
    background: '#ff9900'
  },
  {
    name: 'Azure',
    url: '/stencils/azure.xml',
    foreground: '#00abf0',
    background: '#00abf0'
  },
  {
    name: 'Fluid Power',
    url: '/stencils/fluid_power.xml',
    foreground: 'var(--canvas-fg)',
    background: 'var(--canvas-fg)'
  },
  {
    name: 'IBM',
    url: '/stencils/ibm.xml',
    foreground: 'var(--canvas-fg)',
    background: 'transparent'
  },
  {
    name: 'Web Logos',
    url: '/stencils/weblogos.xml',
    foreground: 'blue',
    background: '#ffffff'
  },
  {
    name: 'Web Icons',
    url: '/stencils/webicons.xml',
    foreground: 'blue',
    background: '#000000'
  },
  {
    name: 'EIP',
    url: '/stencils/eip.xml',
    foreground: 'black',
    background: '#c0f5a9'
  },
  {
    name: 'Arrows',
    url: '/stencils/arrows.xml',
    foreground: 'var(--canvas-fg)',
    background: 'transparent'
  },
  {
    name: 'Basic',
    url: '/stencils/basic.xml',
    foreground: 'var(--canvas-fg)',
    background: 'transparent'
  }
];

const diagramFactory = (d: SerializedDiagram, doc: DiagramDocument) => {
  return new Diagram(d.id, d.name, doc);
};

const documentFactory = () => {
  return new DiagramDocument(defaultNodeRegistry(), defaultEdgeRegistry());
};

const diagrams = [
  /*{
    name: 'Simple',
    document: () => deserializeDiagramDocument(simpleDiagram, documentFactory, diagramFactory)
  },*/
  {
    name: 'Drawio',
    document: async () => {
      const res = await fetch(
        location.hash !== '' ? location.hash.slice(1) : '/diagrams/test6.drawio'
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
    />
  </React.StrictMode>
);
