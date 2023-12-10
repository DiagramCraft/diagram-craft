import { EditableDiagram } from '../model-editor/editable-diagram.ts';
import { useRedraw } from '../react-canvas-viewer/useRedraw.tsx';
import * as Accordion from '@radix-ui/react-accordion';
import { AccordionTrigger } from './AccordionTrigger.tsx';
import { AccordionContent } from './AccordionContext.tsx';
import { useEventListener } from './hooks/useEventListener.ts';
import { TbCircleArrowRightFilled, TbCircleDotted } from 'react-icons/tb';

const formatTimestamp = (ts: Date | undefined) => {
  if (!ts) {
    return '';
  }
  return '[' + ts.toLocaleTimeString() + ']';
};

export const HistoryToolWindow = (props: Props) => {
  const redraw = useRedraw();
  useEventListener(props.diagram.undoManager, '*', redraw);

  const redoActions = props.diagram.undoManager.redoableActions;
  const undoActions = props.diagram.undoManager.undoableActions.toReversed();

  return (
    <Accordion.Root className="cmp-accordion" type="multiple" defaultValue={['history']}>
      <Accordion.Item className="cmp-accordion__item" value="history">
        <AccordionTrigger>History</AccordionTrigger>
        <AccordionContent>
          <div className={'util-vstack'}>
            {redoActions.map((a, idx) => (
              <div key={idx} className={'util-vcenter util-hgap'}>
                <TbCircleDotted />
                <span>
                  {a?.description} {formatTimestamp(a.timestamp)}
                </span>
              </div>
            ))}
            {undoActions.map((a, idx) => (
              <div key={idx} className={'util-vcenter util-hgap'}>
                {idx === 0 && <TbCircleArrowRightFilled />}
                {idx !== 0 && <TbCircleDotted />}
                <span>
                  {a?.description} {formatTimestamp(a.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </AccordionContent>
      </Accordion.Item>
    </Accordion.Root>
  );
};

type Props = {
  diagram: EditableDiagram;
};
