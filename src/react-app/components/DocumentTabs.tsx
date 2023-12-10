import * as Tabs from '@radix-ui/react-tabs';
import { DiagramDocument } from '../../model-viewer/diagramDocument.ts';
import { useRedraw } from '../../react-canvas-viewer/useRedraw.tsx';
import { useEventListener } from '../hooks/useEventListener.ts';
import { TbPlus } from 'react-icons/tb';
import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import {
  defaultEdgeRegistry,
  defaultNodeRegistry
} from '../../react-canvas-viewer/defaultRegistry.ts';
import { newid } from '../../utils/id.ts';

export const DocumentTabs = (props: Props) => {
  const redraw = useRedraw();
  useEventListener(props.document, 'diagramremoved', redraw);
  useEventListener(props.document, 'diagramchanged', redraw);
  useEventListener(props.document, 'diagramadded', redraw);

  return (
    <Tabs.Root value={props.value} onValueChange={props.onValueChange}>
      <Tabs.List className="cmp-document-tabs" aria-label="Diagrams in document">
        {props.document.diagrams.map(d => (
          <Tabs.Trigger key={d.id} className="cmp-document-tabs__tab-trigger" value={d.id}>
            {d.name}
          </Tabs.Trigger>
        ))}
        <button
          className={'cmp-document-tabs__add'}
          onClick={() => {
            const id = newid();
            props.document.addDiagram(
              new EditableDiagram(
                id,
                'Sheet ' + (props.document.diagrams.length + 1).toString(),
                [],
                defaultNodeRegistry(),
                defaultEdgeRegistry()
              )
            );
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  document: DiagramDocument<any>;
};
