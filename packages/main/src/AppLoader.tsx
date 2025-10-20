import { useCallback, useEffect, useState } from 'react';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { Diagram } from '@diagram-craft/model/diagram';
import { App, DiagramRef } from './App';
import { NodeDefinitionRegistry } from '@diagram-craft/model/elementDefinitionRegistry';
import { loadFileFromUrl, stencilLoaderRegistry } from '@diagram-craft/canvas-app/loaders';
import { assert } from '@diagram-craft/utils/assert';
import { newid } from '@diagram-craft/utils/id';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { Progress, ProgressCallback } from '@diagram-craft/model/types';
import type { DiagramFactory, DocumentFactory } from '@diagram-craft/model/factory';
import type { AwarenessUserState } from '@diagram-craft/model/collaboration/awareness';
import { UserState } from './UserState';
import { AppConfig, type StencilRegistryConfig } from './appConfig';
import { Autosave } from './react-app/autosave/Autosave';

const loadInitialDocument = async (
  diagram: DiagramRef | undefined,
  userState: AwarenessUserState,
  documentFactory: DocumentFactory,
  diagramFactory: DiagramFactory,
  progress: ProgressCallback,
  opts?: {
    forceLoadFromServer?: boolean;
    forceClearServerState?: boolean;
  }
): Promise<{ doc?: DiagramDocument; url?: string }> => {
  const root = await documentFactory.loadCRDT(diagram?.url, userState, progress);
  if (opts?.forceClearServerState || AppConfig.get().collaboration.forceClearServerState()) {
    console.log('Clear server state');
    root.clear();
  }

  if (diagram) {
    if (
      opts?.forceLoadFromServer ||
      root.hasData() ||
      AppConfig.get().collaboration.forceLoadFromServer()
    ) {
      console.log('Load from server');
      const v = await documentFactory.createDocument(root, diagram.url, progress);
      return { doc: v, url: diagram.url };
    } else {
      // Try multi-window autosave first
      const multiWindowAutosaved = await Autosave.get().load(
        root,
        progress,
        documentFactory,
        diagramFactory,
        true
      );

      if (multiWindowAutosaved) {
        console.log('Load from auto save');
        multiWindowAutosaved.document.url = diagram.url;
        return { doc: multiWindowAutosaved.document, url: diagram.url };
      } else {
        console.log('Load from url');
        const defDiagram = await loadFileFromUrl(
          diagram.url,
          userState,
          progress,
          documentFactory,
          diagramFactory,
          { root }
        );
        defDiagram.url = diagram?.url;
        return { doc: defDiagram, url: diagram?.url };
      }
    }
  } else {
    const doc = await documentFactory.createDocument(root, undefined, progress);

    const diagram = new Diagram(newid(), 'Untitled', doc);
    diagram.layers.add(
      new RegularLayer(newid(), 'Default', [], diagram),
      UnitOfWork.immediate(diagram)
    );
    doc.addDiagram(diagram);

    progress('complete', {});

    return { doc };
  }
};

export const AppLoader = (props: Props) => {
  const [doc, setDoc] = useState<DiagramDocument | undefined>(undefined);
  const [url, setUrl] = useState<string | undefined>(props.diagram?.url);
  const [loaded, setLoaded] = useState<boolean>(false);

  const [progress, setProgress] = useState<Progress | undefined>(undefined);
  const progressCallback = useCallback<ProgressCallback>(
    (status, opts) => queueMicrotask(() => setProgress({ status, ...opts })),
    []
  );

  const load = useCallback(
    (ref?: DiagramRef) => {
      loadInitialDocument(
        ref,
        UserState.get().awarenessState,
        props.documentFactory,
        props.diagramFactory,
        progressCallback
      ).then(({ doc, url }) => {
        if (doc) setDoc(doc);
        if (url) setUrl(url);
      });
    },
    [progressCallback, props.diagramFactory, props.documentFactory]
  );

  useEffect(() => {
    if (!doc) return;
    for (const def of props.stencils) {
      const loader = stencilLoaderRegistry[def.type];
      assert.present(loader, `Stencil loader ${def.type} not found`);

      // biome-ignore lint/suspicious/noExplicitAny: false positive
      loader().then(loader => loader(doc.nodeDefinitions, def.opts as any));
    }
  }, [props.stencils, doc]);

  useEffect(() => {
    load(props.diagram);
  }, [load, props.diagram]);

  useEffect(() => {
    if (doc && progress?.status === 'complete') {
      setLoaded(true);
    }
  }, [doc, progress]);

  useEffect(() => {
    if (!doc) return;
    if (!url) return;

    doc.on(
      'cleared',
      () => {
        console.log('Reloading from server');

        // Reset
        setDoc(undefined);
        setLoaded(false);
        setProgress(undefined);

        doc.deactivate(() => {});
        load({ url: url });
      },
      { id: 'doc-cleared' }
    );
    return () => doc.off('cleared', 'doc-cleared');
  }, [doc, load, url]);

  if (doc && doc.diagrams.length === 0) {
    console.error('Doc contains no diagrams');
    return null;
  }

  return (
    <div>
      {!loaded && progress?.status !== 'complete' && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'black'
          }}
        >
          {progress?.status.toUpperCase()}: {progress?.message}
        </div>
      )}
      {loaded && (
        <App
          doc={doc!}
          url={url}
          documentFactory={props.documentFactory}
          diagramFactory={props.diagramFactory}
        />
      )}
    </div>
  );
};

type Props = {
  stencils: StencilRegistryConfig;
  diagram?: DiagramRef;
  diagramFactory: DiagramFactory;
  documentFactory: DocumentFactory;

  nodeRegistry: NodeDefinitionRegistry;
};
