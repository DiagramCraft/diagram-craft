import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { useRedraw } from '../../react-canvas-viewer/useRedraw.tsx';
import { useEventListener } from '../hooks/useEventListener.ts';
import { KeyMap } from '../../base-ui/keyMap.ts';
import * as Accordion from '@radix-ui/react-accordion';
import { AccordionTrigger } from '../AccordionTrigger.tsx';
import { AccordionContent } from '../AccordionContext.tsx';

export const CanvasGuidesProperties = (props: Props) => {
  const redraw = useRedraw();

  useEventListener('canvaschanged', redraw, props.diagram);

  return (
    <Accordion.Item className="cmp-accordion__item" value="line">
      <AccordionTrigger>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            className="cmp-accordion__enabled"
            type={'checkbox'}
            checked={false}
            onChange={() => {}}
            onClick={e => {
              console.log(e);
            }}
          />
          <span>Guides</span>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className={'cmp-labeled-table'}>
          <div className={'cmp-labeled-table__label'}>Guides:</div>
          <div className={'cmp-labeled-table__value'}>Not implemented yet</div>
        </div>
      </AccordionContent>
    </Accordion.Item>
  );
};

type Props = {
  actionMap: Partial<ActionMap>;
  keyMap: KeyMap;
  diagram: EditableDiagram;
};
