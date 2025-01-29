import { useEffect, useState } from 'react';
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

export const AppLoader = (props: Props) => {
  const [doc, setDoc] = useState<DiagramDocument | undefined>(undefined);
  const [url, setUrl] = useState<string | undefined>(props.diagram?.url);

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
      Promise.all([
        Autosave.load(props.documentFactory, props.diagramFactory, true),
        loadFileFromUrl(props.diagram.url, props.documentFactory, props.diagramFactory)
      ]).then(([autosaved, defDiagram]) => {
        setDoc(autosaved?.document ?? defDiagram);
        (autosaved?.document ?? defDiagram).url = props.diagram?.url;
        if (autosaved) setUrl(autosaved.url);
      });
    } else {
      // TODO: This is duplicated in fileNewAction.ts
      const doc = props.documentFactory();
      const diagram = new Diagram(newid(), 'Untitled', doc);
      diagram.layers.add(
        new RegularLayer(newid(), 'Default', [], diagram),
        UnitOfWork.immediate(diagram)
      );
      doc.addDiagram(diagram);
      setDoc(doc);
    }
  }, [props.diagramFactory, props.documentFactory]);

  if (doc && doc.topLevelDiagrams.length === 0) {
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
    />
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
