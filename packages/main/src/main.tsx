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
} from '@diagram-craft/model/diagramDocumentFactory';
import { AppConfig, type StencilRegistryConfig } from './appConfig';
import { ElectronIntegration } from './electron';
import { Autosave } from './react-app/autosave/Autosave';
import { registerDefaultEffects } from '@diagram-craft/canvas/effects/effects';
import { StencilRegistry } from '@diagram-craft/model/elementDefinitionRegistry';

ELECTRON: {
  if (window.electronAPI) {
    ElectronIntegration.init();
  }
}

const stencils = new StencilRegistry();
const nodes = defaultNodeRegistry(stencils);
const stencilRegistryConfig: StencilRegistryConfig = AppConfig.get().stencils?.registry ?? [];
for (let i = 0; i < stencilRegistryConfig.length; i++) {
  const s = stencilRegistryConfig[i]!;
  if (s.shapes) {
    nodes.preregister(s.shapes, s.type, s.opts);
  }
}
registerDrawioBaseNodeTypes(nodes);

const edges = defaultEdgeRegistry(stencils);

registerDefaultEffects();

const diagramFactory = makeDefaultDiagramFactory();
const documentFactory = makeDefaultDocumentFactory({ nodes, edges, stencils });

const diagrams: Array<DiagramRef> = [];

if (location.hash !== '') {
  const url = location.hash.slice(1);
  diagrams.unshift({ url });
  Autosave.get().clear();
} else {
  const userState = UserState.get();
  if (userState.recentFiles.length > 0) {
    diagrams.unshift({ url: userState.recentFiles[0]! });
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <AppLoader
    stencils={stencilRegistryConfig}
    diagram={diagrams[0]}
    diagramFactory={diagramFactory}
    documentFactory={documentFactory}
    nodeRegistry={nodes}
  />
);
