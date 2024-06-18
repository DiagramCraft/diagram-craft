import { useEffect, useState } from 'react';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { DiagramFactory, DocumentFactory } from '@diagram-craft/model/serialization/deserialize';
import { Diagram } from '@diagram-craft/model/diagram';
import { App, DiagramRef } from './App';
import {
  NodeDefinitionRegistry,
  StencilPackage
} from '@diagram-craft/model/elementDefinitionRegistry';
import { useRedraw } from './react-app/useRedraw';
import {
  toRegularStencil,
  loadDrawioStencils
} from '@diagram-craft/canvas-app/drawio/drawioStencilLoader';
import { ShapeParser, shapeParsers } from '@diagram-craft/canvas-app/drawio/drawioReader';
import { VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';

export const AppLoader = (props: Props) => {
  const [doc, setDoc] = useState<DiagramDocument | undefined>(undefined);
  // TODO: Allow loading stencils from variety of sources
  const [stencils, setStencils] = useState<Array<StencilPackage>>(
    props.stencils
      .filter(isStencilRegistryConfigDrawioXML)
      .map(s => ({ id: s.name, name: s.name, stencils: [] }))
      .sort((a, b) => a.name.localeCompare(b.name))
  );
  const redraw = useRedraw();

  useEffect(() => {
    for (const def of props.stencils) {
      if (isStencilRegistryConfigDrawioXML(def)) {
        loadDrawioStencils(def.url, def.name, def.foreground, def.background).then(
          drawioStencils => {
            setStencils(arr =>
              arr.map(a =>
                a.name === def.name
                  ? { id: def.name, name: def.name, stencils: drawioStencils.map(toRegularStencil) }
                  : a
              )
            );
          }
        );
      } else if (isStencilRegistryConfigDrawioManual(def)) {
        def.callback.then(cb => cb(props.nodeRegistry, shapeParsers));
      } else {
        VERIFY_NOT_REACHED();
      }
    }
  }, [props.stencils]);

  useEffect(() => {
    Promise.all([
      //      Autosave.load(props.documentFactory, props.diagramFactory),
      props.diagram.document()
    ]).then(([/*autosaved,*/ defDiagram]) => {
      setDoc(/*autosaved ?? */ defDiagram);
    });
  }, [props.diagramFactory, props.recent, props.documentFactory]);

  useEffect(() => {
    if (!doc) return;

    stencils.forEach(pkg => {
      doc.nodeDefinitions.stencilRegistry.register(pkg);
      doc.nodeDefinitions.stencilRegistry.activate(pkg.id);
    });

    // TODO: Can we avoid explicit redraw here, and instead have a listener on the nodeDefinition
    redraw();
  }, [doc, stencils]);

  if (doc && doc.diagrams.length === 0) {
    console.error('Doc contains no diagrams');
    return null;
  }

  if (doc) return <App doc={doc} recent={props.recent} />;
  else return null;
};

type StencilRegistryConfigDrawioXML = {
  type: 'drawioXml';
  name: string;
  url: string;
  foreground: string;
  background: string;
};

type StencilRegistryConfigDrawioManual = {
  type: 'drawioManual';
  callback: Promise<
    (r: NodeDefinitionRegistry, shapeParser: Record<string, ShapeParser>) => Promise<void>
  >;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isStencilRegistryConfigDrawioXML = (e: any): e is StencilRegistryConfigDrawioXML =>
  e.type === 'drawioXml';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isStencilRegistryConfigDrawioManual = (e: any): e is StencilRegistryConfigDrawioManual =>
  e.type === 'drawioManual';

export type StencilRegistryConfig = Array<
  StencilRegistryConfigDrawioXML | StencilRegistryConfigDrawioManual
>;

type Props = {
  stencils: StencilRegistryConfig;
  recent: Array<DiagramRef>;
  diagram: DiagramRef;
  diagramFactory: DiagramFactory<Diagram>;
  documentFactory: DocumentFactory;

  nodeRegistry: NodeDefinitionRegistry;
};
