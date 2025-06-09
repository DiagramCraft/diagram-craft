import { useCallback, useEffect, useState } from 'react';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { DiagramFactory, DocumentFactory } from '@diagram-craft/model/serialization/deserialize';
import { Diagram } from '@diagram-craft/model/diagram';
import { App, DiagramRef } from './App';
import { NodeDefinitionRegistry } from '@diagram-craft/model/elementDefinitionRegistry';
import { loadFileFromUrl, stencilLoaderRegistry } from '@diagram-craft/canvas-app/loaders';
import { assert } from '@diagram-craft/utils/assert';
import { Autosave } from './Autosave';
import { newid } from '@diagram-craft/utils/id';
import { RegularLayer } from '@diagram-craft/model/diagramLayer';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { Progress, ProgressCallback } from '@diagram-craft/model/types';

export const AppLoader = (props: Props) => {
  const [doc, setDoc] = useState<DiagramDocument | undefined>(undefined);
  const [url, setUrl] = useState<string | undefined>(props.diagram?.url);
  const [loaded, setLoaded] = useState<boolean>(false);

  const [progress, setProgress] = useState<Progress | undefined>(undefined);
  const progressCallback = useCallback<ProgressCallback>(
    (status, opts) => {
      queueMicrotask(() => {
        setProgress({
          status,
          ...opts
        });
      });
    },
    [setProgress]
  );

  useEffect(() => {
    if (!doc) return;
    for (const def of props.stencils) {
      const loader = stencilLoaderRegistry[def.type];
      assert.present(loader, `Stencil loader ${def.type} not found`);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      loader().then(loader => loader(doc!.nodeDefinitions, def.opts as any));
    }
  }, [props.stencils, doc]);

  useEffect(() => {
    if (props.diagram) {
      Autosave.load(progressCallback, props.documentFactory, props.diagramFactory, true).then(
        autosaved => {
          if (autosaved?.document) {
            setDoc(autosaved?.document);
            autosaved.document!.url = props.diagram?.url;
            setUrl(autosaved.url);
          } else {
            loadFileFromUrl(
              props.diagram!.url,
              progressCallback,
              props.documentFactory,
              props.diagramFactory
            ).then(defDiagram => {
              setDoc(defDiagram);
              defDiagram!.url = props.diagram?.url;
            });
          }
        }
      );
    } else {
      props.documentFactory(undefined, progressCallback).then(doc => {
        // TODO: This is duplicated in fileNewAction.ts
        const diagram = new Diagram(newid(), 'Untitled', doc);
        diagram.layers.add(
          new RegularLayer(newid(), 'Default', [], diagram),
          UnitOfWork.immediate(diagram)
        );
        doc.addDiagram(diagram);
        setDoc(doc);
      });
    }
  }, [props.diagramFactory, props.documentFactory]);

  useEffect(() => {
    if (doc && progress?.status === 'complete') {
      setLoaded(true);
    }
  }, [doc, progress]);

  if (doc && doc.topLevelDiagrams.length === 0) {
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

type StencilRegistryConfigEntry<K extends keyof StencilLoaderOpts> = {
  type: K;
  shapes?: RegExp;
  opts: StencilLoaderOpts[K];
};

export type StencilRegistryConfig = Array<StencilRegistryConfigEntry<keyof StencilLoaderOpts>>;

type Props = {
  stencils: StencilRegistryConfig;
  diagram?: DiagramRef;
  diagramFactory: DiagramFactory<Diagram>;
  documentFactory: DocumentFactory;

  nodeRegistry: NodeDefinitionRegistry;
};
