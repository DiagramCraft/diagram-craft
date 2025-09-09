import './initial-loader';

import ReactDOM from 'react-dom/client';
import { AppLoader } from './AppLoader';
import './index.css';
import {
  defaultEdgeRegistry,
  defaultNodeRegistry
} from '@diagram-craft/canvas-app/defaultRegistry';
import { registerDrawioBaseNodeTypes } from '@diagram-craft/canvas-drawio/register';
import { DiagramRef } from './App';
import { UserState } from './UserState';
import {
  makeDefaultDiagramFactory,
  makeDefaultDocumentFactory
} from '@diagram-craft/model/factory';
import { AppConfig, type StencilRegistryConfig } from './appConfig';
import { ElectronIntegration } from './electron';
import { MultiWindowAutosave } from './MultiWindowAutosave';

ELECTRON: {
  if (window.electronAPI) {
    ElectronIntegration.init();
  }
}

const nodeRegistry = defaultNodeRegistry();
const stencilRegistry: StencilRegistryConfig = AppConfig.get().stencils?.registry ?? [];
for (let i = 0; i < stencilRegistry.length; i++) {
  const s = stencilRegistry[i];
  if (s.shapes) {
    nodeRegistry.preregister(s.shapes, s.type, s.opts);
  }
}
registerDrawioBaseNodeTypes(nodeRegistry);

const edgeRegistry = defaultEdgeRegistry();

const diagramFactory = makeDefaultDiagramFactory();
const documentFactory = makeDefaultDocumentFactory(nodeRegistry, edgeRegistry);

const diagrams: Array<DiagramRef> = [];

if (location.hash !== '') {
  const url = location.hash.slice(1);
  diagrams.unshift({ url });
  MultiWindowAutosave.clear();
} else {
  const userState = UserState.get();
  if (userState.recentFiles.length > 0) {
    diagrams.unshift({ url: userState.recentFiles[0] });
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <AppLoader
    stencils={stencilRegistry}
    diagram={diagrams[0]}
    diagramFactory={diagramFactory}
    documentFactory={documentFactory}
    nodeRegistry={nodeRegistry}
  />
);
