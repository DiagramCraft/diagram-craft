import { useRedraw } from '../../react-canvas-viewer/useRedraw.tsx';
import { useEventListener } from '../hooks/useEventListener.ts';
import * as Accordion from '@radix-ui/react-accordion';
import { AccordionTrigger } from '../AccordionTrigger.tsx';
import { AccordionContent } from '../AccordionContext.tsx';
import { useDiagram } from '../context/DiagramContext.tsx';

export const CanvasGuidesProperties = () => {
  const diagram = useDiagram();
  const redraw = useRedraw();

  useEventListener(diagram, 'canvaschanged', redraw);

  return (
    <Accordion.Item className="cmp-accordion__item" value="guides">
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
