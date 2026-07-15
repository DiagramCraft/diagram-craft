import { useCallback, useEffect, useState } from 'react';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { App, DiagramRef } from './App';
import { NodeDefinitionRegistry } from '@diagram-craft/model/elementDefinitionRegistry';
import type { DiagramFactory, DocumentFactory } from '@diagram-craft/model/diagramDocumentFactory';
import type { CollaborationAwareness } from './CollaborationAwareness';
import { getDefaultStencilPackages, type StencilRegistryConfig } from './appConfig';
import type { Progress, ProgressCallback } from '@diagram-craft/utils/progress';
import { loadDocument } from './embed/loadDocument';
import { registerDocumentStencils } from './embed/registerStencils';

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
      loadDocument({
        url: ref?.url,
        awareness: props.awareness.state,
        documentFactory: props.documentFactory,
        diagramFactory: props.diagramFactory,
        progress: progressCallback
      }).then(({ doc, url }) => {
        setDoc(doc);
        if (url) setUrl(url);
      });
    },
    [progressCallback, props.awareness, props.diagramFactory, props.documentFactory]
  );

  useEffect(() => {
    if (!doc) return;
    if (doc.props.activeStencilPackages.ids.length === 0) {
      doc.props.activeStencilPackages.set(getDefaultStencilPackages());
    }
    registerDocumentStencils(doc, props.stencils);
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
        doc.deactivate(() => {});
        doc.release();
        setDoc(undefined);
        setLoaded(false);
        setProgress(undefined);

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
          awareness={props.awareness}
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
  awareness: CollaborationAwareness;
};
