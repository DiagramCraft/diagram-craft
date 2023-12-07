import * as Tabs from '@radix-ui/react-tabs';
import { DiagramDocument } from '../../model-viewer/diagramDocument.ts';
import { useRedraw } from '../../react-canvas-viewer/useRedraw.tsx';
import { useEventListener } from '../hooks/useEventListener.ts';

export const DocumentTabs = (props: Props) => {
  const redraw = useRedraw();
  useEventListener('*', redraw, props.document);

  return (
    <Tabs.Root value={props.value} onValueChange={props.onValueChange}>
      <Tabs.List className="cmp-document-tabs" aria-label="Diagrams in document">
        {props.document.diagrams.map(d => (
          <Tabs.Trigger key={d.id} className="cmp-document-tabs__tab-trigger" value={d.id}>
            {d.name}
          </Tabs.Trigger>
        ))}
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
