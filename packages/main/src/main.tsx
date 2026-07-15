import { diagramCraft } from './initial-loader';

import ReactDOM from 'react-dom/client';
import { AppLoader } from './AppLoader';
import './index.css';
import { DiagramRef } from './App';
import { UserState } from './UserState';
import { CollaborationAwareness } from './CollaborationAwareness';
import { AppConfig } from './appConfig';
import { ElectronIntegration } from './electron';
import { Autosave } from './react-app/autosave/Autosave';

const awareness = new CollaborationAwareness();

ELECTRON: {
  if (window.electronAPI) {
    ElectronIntegration.init(awareness);
  }
}

const { diagramFactory, documentFactory, nodeRegistry: nodes } = diagramCraft;

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
    awareness={awareness}
  />
);
