import { useEffect, useState } from 'react';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { StencilPackage } from '@diagram-craft/model/elementDefinitionRegistry';
import { useRedraw } from './react-app/useRedraw';
import { DiagramFactory, DocumentFactory } from '@diagram-craft/model/serialization/deserialize';
import { Diagram } from '@diagram-craft/model/diagram';
import { App, DiagramRef } from './App';
import { loadStencil } from '@diagram-craft/canvas-app/drawio/stencilLoader';
import { Autosave } from './Autosave';

export const AppLoader = (props: Props) => {
  const [doc, setDoc] = useState<DiagramDocument | undefined>(undefined);
  const [stencils, setStencils] = useState<Array<StencilPackage>>(
    props.stencils
      .map(s => ({ name: s.name, stencils: [] }))
      .sort((a, b) => a.name.localeCompare(b.name))
  );
  const redraw = useRedraw();

  useEffect(() => {
    for (const def of props.stencils) {
      loadStencil(def.url, def.name, def.foreground, def.background).then(newStencils => {
        setStencils(arr =>
          arr.map(a => (a.name === def.name ? { name: def.name, stencils: newStencils } : a))
        );
      });
    }
  }, [props.stencils]);

  useEffect(() => {
    Promise.all([
      Autosave.load(props.documentFactory, props.diagramFactory),
      props.diagram.document()
    ]).then(([autosaved, defDiagram]) => {
      setDoc(autosaved ?? defDiagram);
    });
  }, [props.diagramFactory, props.recent, props.documentFactory]);

  useEffect(() => {
    if (!doc) return;

    stencils.forEach(pkg => {
      doc.nodeDefinitions.addGroup(pkg.name);
      pkg.stencils.forEach(stencil => {
        doc.nodeDefinitions.register(stencil.node, stencil);
      });
    });

    // TODO: Can we avoid explicit redraw here, and instead have a listener on the nodeDefinition
    redraw();
  }, [doc, stencils]);

  if (doc) return <App doc={doc} recent={props.recent} />;
  else return null;
};

type Props = {
  stencils: Array<{
    name: string;
    url: string;
    foreground: string;
    background: string;
  }>;
  recent: Array<DiagramRef>;
  diagram: DiagramRef;
  diagramFactory: DiagramFactory<Diagram>;
  documentFactory: DocumentFactory;
};
