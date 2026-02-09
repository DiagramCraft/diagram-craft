import './initial-loader';

import ReactDOM from 'react-dom/client';
import { AppLoader } from './AppLoader';
import './index.css';
import { defaultRegistry } from '@diagram-craft/canvas-app/defaultRegistry';
import { registerDrawioBaseNodeTypes } from '@diagram-craft/canvas-drawio/register';
import { DiagramRef } from './App';
import { UserState } from './UserState';
import {
  makeDefaultDiagramFactory,
  makeDefaultDocumentFactory
} from '@diagram-craft/model/diagramDocumentFactory';
import { AppConfig } from './appConfig';
import { ElectronIntegration } from './electron';
import { Autosave } from './react-app/autosave/Autosave';
import { registerDefaultEffects } from '@diagram-craft/canvas/effects/effects';
import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import { markdownToHTML } from '@diagram-craft/markdown';
import { htmlStringToMarkdown } from '@diagram-craft/markdown';

ELECTRON: {
  if (window.electronAPI) {
    ElectronIntegration.init();
  }
}

ShapeNodeDefinition.DEFAULT_TEXT_HANDLERS = {
  format: 'Markdown',
  dialog: {
    editToStored: (s: string) => markdownToHTML(s, 'extended'),
    storedToEdit: (s: string) => htmlStringToMarkdown(s),
    storedToHTML: (s: string) => s
  }
};

const elementDefConfig = AppConfig.get().elementDefinitions?.registry ?? [];

const { stencils, nodes, edges } = defaultRegistry(elementDefConfig);

// TODO: Can we avoid this - i.e. why is not working to use
//      {
//         shapes: /^(drawio|drawioImage|transparent)$/,
//         nodeDefinitionLoader: async () => {
//           return async d => registerDrawioBaseNodeTypes(d);
//         }
//       }
registerDrawioBaseNodeTypes(nodes);

registerDefaultEffects();

const diagramFactory = makeDefaultDiagramFactory();
const documentFactory = makeDefaultDocumentFactory({ nodes, edges, stencils: stencils });

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
    stencils={AppConfig.get().stencils?.registry ?? []}
    diagram={diagrams[0]}
    diagramFactory={diagramFactory}
    documentFactory={documentFactory}
    nodeRegistry={nodes}
  />
);
