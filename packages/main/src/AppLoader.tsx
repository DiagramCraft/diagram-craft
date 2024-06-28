import { useEffect, useState } from 'react';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { DiagramFactory, DocumentFactory } from '@diagram-craft/model/serialization/deserialize';
import { Diagram } from '@diagram-craft/model/diagram';
import { App, DiagramRef } from './App';
import { NodeDefinitionRegistry } from '@diagram-craft/model/elementDefinitionRegistry';
import { loadFileFromUrl, stencilLoaderRegistry } from '@diagram-craft/canvas-app/loaders';
import { assert } from '@diagram-craft/utils/assert';
import { Autosave } from './Autosave';

export const AppLoader = (props: Props) => {
  const [doc, setDoc] = useState<DiagramDocument | undefined>(undefined);
  const [url, setUrl] = useState<string>(props.diagram.url);

  useEffect(() => {
    if (!doc) return;
    for (const def of props.stencils) {
      const loader = stencilLoaderRegistry[def.type];
      assert.present(loader, `Stencil loader ${def.type} not found`);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      loader().then(loader => loader(doc!.diagrams[0], def.opts as any));
    }
  }, [props.stencils, doc]);

  useEffect(() => {
    Promise.all([
      Autosave.load(props.documentFactory, props.diagramFactory),
      loadFileFromUrl(props.diagram.url, props.documentFactory, props.diagramFactory)
    ]).then(([autosaved, defDiagram]) => {
      setDoc(autosaved?.diagram ?? defDiagram);
      if (autosaved) setUrl(autosaved.url);
    });
  }, [props.diagramFactory, props.recent, props.documentFactory]);

  if (doc && doc.diagrams.length === 0) {
    console.error('Doc contains no diagrams');
    return null;
  }

  if (!doc) return null;

  return (
    <App
      doc={doc}
      url={url}
      documentFactory={props.documentFactory}
      diagramFactory={props.diagramFactory}
      recent={props.recent}
    />
  );
};

type StencilRegistryConfigEntry<K extends keyof StencilLoaderOpts> = {
  type: K;
  opts: StencilLoaderOpts[K];
};

export type StencilRegistryConfig = Array<StencilRegistryConfigEntry<keyof StencilLoaderOpts>>;

type Props = {
  stencils: StencilRegistryConfig;
  recent: Array<DiagramRef>;
  diagram: DiagramRef;
  diagramFactory: DiagramFactory<Diagram>;
  documentFactory: DocumentFactory;

  nodeRegistry: NodeDefinitionRegistry;
};
