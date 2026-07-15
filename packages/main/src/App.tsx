import './App.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { Diagram } from '@diagram-craft/model/diagram';
import { loadFileFromUrl } from '@diagram-craft/canvas-app/loaders';
import { newid } from '@diagram-craft/utils/id';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { Point } from '@diagram-craft/geometry/point';
import { Extent } from '@diagram-craft/geometry/extent';
import type { Progress, ProgressCallback } from '@diagram-craft/utils/progress';
import type { DiagramFactory, DocumentFactory } from '@diagram-craft/model/diagramDocumentFactory';
import { CollaborationConfig } from '@diagram-craft/collaboration/collaborationConfig';
import { ElectronIntegration } from './electron';
import { MainMenu } from './react-app/MainMenu';
import { FileDialog } from './react-app/FileDialog';
import { FullScreenProgress } from './react-app/components/FullScreenProgress';
import { Autosave } from './react-app/autosave/Autosave';
import { Application } from './application';
import { UserState } from './UserState';
import type { CollaborationAwareness } from './CollaborationAwareness';
import { EmbeddableEditor, type FileActions, type DialogStackItem } from './EmbeddableEditor';
import { updateApplicationModel } from './editorShared';
import { assert } from '@diagram-craft/utils/assert';

export type DiagramRef = {
  name?: string;
  url: string;
};

export const App = (props: {
  url?: string;
  doc: DiagramDocument;
  documentFactory: DocumentFactory;
  diagramFactory: DiagramFactory;
  awareness: CollaborationAwareness;
}) => {
  const userState = useRef(UserState.get());
  const application = useRef(new Application(userState.current, props.awareness));

  const [dirty, setDirty] = useState(false);
  const [hash, setHash] = useState(application.current.model.activeDocument?.hash ?? props.doc.hash);
  const [progress, setProgress] = useState<Progress | undefined>(undefined);

  const progressCallback = useCallback<ProgressCallback>(
    (status, opts) => queueMicrotask(() => setProgress({ status, ...opts })),
    []
  );

  // Recent files tracking
  useEffect(() => {
    if (props.url) userState.current.addRecentFile(props.url);
  }, [props.url]);

  // Check initial autosave state
  useEffect(() => {
    if (!CollaborationConfig.isNoOp) {
      setDirty(false);
      return;
    }

    Autosave.get()
      .exists()
      .then(setDirty)
      .catch(e => {
        console.warn(e);
        setDirty(false);
      });
  }, []);

  const onApplicationReady = useCallback((app: Application) => {
    ELECTRON: {
      if (window.electronAPI) {
        ElectronIntegration.bindActions(app);
      }
    }
  }, []);

  const fileActions: FileActions = {
    loadDocument: async (url: string) => {
      const doc = await loadFileFromUrl(
        url,
        props.awareness.state,
        progressCallback,
        props.documentFactory,
        props.diagramFactory
      );
      doc.url = url;

      assert.arrayNotEmpty(doc.diagrams);
      updateApplicationModel(doc, application.current, progressCallback);

      Autosave.get().clear();
      setDirty(false);
      setHash(doc.hash);

      userState.current.addRecentFile(url);
    },
    newDocument: async (size?: Extent, offset?: Point) => {
      const doc = await props.documentFactory.createDocument(
        await props.documentFactory.loadCRDT(
          undefined,
          props.awareness.state,
          progressCallback
        ),
        undefined,
        progressCallback
      );
      const diagram = new Diagram(newid(), 'Untitled', doc, undefined, size, offset);
      UnitOfWork.execute(diagram, uow =>
        diagram.layers.add(new RegularLayer(newid(), 'Default', [], diagram), uow)
      );
      doc.addDiagram(diagram);

      updateApplicationModel(diagram.document, application.current, progressCallback);

      Autosave.get().clear();
      setDirty(false);
      setHash(doc.hash);
    },
    clearDirty: () => {
      Autosave.get().clear();
      setDirty(false);
      setHash(application.current.model.activeDocument.hash);
    }
  };

  // biome-ignore lint/suspicious/noExplicitAny: false positive
  const autosave = (event: any) => {
    const url = application.current.model.activeDocument.url;
    const doc = application.current.model.activeDocument;

    if (!CollaborationConfig.isNoOp) {
      if (dirty) setDirty(false);
      return;
    }
    if (event.silent) return;

    Autosave.get().asyncSave(url, doc, s => {
      const newDirtyValue = s.hash !== hash;
      if (newDirtyValue !== dirty) setDirty(newDirtyValue);
    });
    if (!dirty) setDirty(true);
  };

  const headerLeft = <MainMenu />;

  const extraDialogs = (dialogStack: DialogStackItem[]) => (
    <>
      {dialogStack.map(item => {
        if (item.dialog.id !== 'fileOpen') return null;
        return (
          <div key={item.id} style={{ zIndex: item.zIndex }}>
            <FileDialog
              open={true}
              {...item.dialog.props}
              onOk={item.dialog.onOk}
              onCancel={item.dialog.onCancel}
            />
          </div>
        );
      })}
      {dialogStack.map(item => {
        if (item.dialog.id !== 'fileSaveAs') return null;
        return (
          <div key={item.id} style={{ zIndex: item.zIndex }}>
            <FileDialog
              open={true}
              {...item.dialog.props}
              onOk={item.dialog.onOk}
              onCancel={item.dialog.onCancel}
            />
          </div>
        );
      })}
    </>
  );

  const overlay =
    progress === undefined ||
    (progress?.status !== 'complete' && (
      <FullScreenProgress
        message={progress?.message ?? ''}
        isError={progress?.status === 'error'}
      />
    ));

  return (
    <EmbeddableEditor
      doc={props.doc}
      documentFactory={props.documentFactory}
      diagramFactory={props.diagramFactory}
      dirty={dirty}
      application={application.current}
      headerLeft={headerLeft}
      wrapperClassName={null}
      fileActions={fileActions}
      progressCallback={progressCallback}
      onApplicationReady={onApplicationReady}
      onDiagramChange={autosave}
      extraDialogs={extraDialogs}
      overlay={overlay}
    />
  );
};
