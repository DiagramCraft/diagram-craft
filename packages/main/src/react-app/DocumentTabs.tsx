import * as Tabs from '@radix-ui/react-tabs';
import { useRedraw } from './useRedraw';
import { useEventListener } from './hooks/useEventListener';
import { TbFiles, TbPlus } from 'react-icons/tb';
import { DocumentsContextMenu } from './DocumentsContextMenu';
import {
  defaultEdgeRegistry,
  defaultNodeRegistry
} from '@diagram-craft/canvas-app/defaultRegistry';
import { Diagram } from '@diagram-craft/model/diagram';
import { Layer } from '@diagram-craft/model/diagramLayer';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { newid } from '@diagram-craft/utils/id';

export const DocumentTabs = (props: Props) => {
  const redraw = useRedraw();
  useEventListener(props.document, 'diagramremoved', redraw);
  useEventListener(props.document, 'diagramchanged', redraw);
  useEventListener(props.document, 'diagramadded', redraw);

  const selection = props.document.diagrams.find(
    d => d.id === props.value || d.findChildDiagramById(props.value) !== undefined
  )?.id;

  return (
    <Tabs.Root value={selection} onValueChange={props.onValueChange}>
      <Tabs.List className="cmp-document-tabs" aria-label="Diagrams in document">
        {props.document.diagrams.map(d => (
          <Tabs.Trigger
            key={d.id}
            className="cmp-document-tabs__tab-trigger util-vcenter"
            value={d.id}
          >
            <DocumentsContextMenu documentId={d.id}>
              <div>
                {d.name}

                {selection === d.id && selection !== props.value && (
                  <span>&nbsp;&gt;&nbsp;{props.document.getById(props.value)!.name}</span>
                )}

                {d.diagrams.length > 0 && (
                  <div style={{ marginLeft: '0.35rem', marginTop: '0.1rem' }}>
                    <TbFiles />
                  </div>
                )}
              </div>
            </DocumentsContextMenu>
          </Tabs.Trigger>
        ))}
        <button
          className={'cmp-document-tabs__add'}
          onClick={() => {
            const id = newid();

            // TODO: Add undo here

            const diagram = new Diagram(
              id,
              'Sheet ' + (props.document.diagrams.length + 1).toString(),
              defaultNodeRegistry(),
              defaultEdgeRegistry()
            );
            diagram.layers.add(
              new Layer('default', 'Default', [], diagram),
              UnitOfWork.throwaway(diagram)
            );

            props.document.addDiagram(diagram);
            props.onValueChange(id);
          }}
        >
          <TbPlus />
        </button>
      </Tabs.List>
    </Tabs.Root>
  );
};

type Props = {
  value: string;
  onValueChange: (v: string) => void;
  document: DiagramDocument;
};
