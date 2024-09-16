import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { TbCircleArrowRightFilled, TbCircleDotted } from 'react-icons/tb';
import { Accordion } from '@diagram-craft/app-components/Accordion';
import { useDiagram } from '../../../application';

const formatTimestamp = (ts: Date | undefined) => {
  if (!ts) {
    return '';
  }
  return '[' + ts.toLocaleTimeString() + ']';
};

export const HistoryToolWindow = () => {
  const diagram = useDiagram();
  const redraw = useRedraw();
  useEventListener(diagram.undoManager, 'change', redraw);

  const redoActions = diagram.undoManager.redoableActions;
  const undoActions = diagram.undoManager.undoableActions.toReversed();

  return (
    <Accordion.Root disabled={true} type="multiple" defaultValue={['history']}>
      <Accordion.Item value="history">
        <Accordion.ItemHeader>History</Accordion.ItemHeader>
        <Accordion.ItemContent>
          <div className={'util-vstack'}>
            {redoActions.map((a, idx) => (
              <div key={idx} className={'util-vcenter util-hgap'}>
                <TbCircleDotted />
                <span>
                  {a.description} {formatTimestamp(a.timestamp)}
                </span>
              </div>
            ))}
            {undoActions.map((a, idx) => (
              <div key={idx} className={'util-vcenter util-hgap'}>
                {idx === 0 && <TbCircleArrowRightFilled />}
                {idx !== 0 && <TbCircleDotted />}
                <span>
                  {a.description} {formatTimestamp(a.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </Accordion.ItemContent>
      </Accordion.Item>
    </Accordion.Root>
  );
};
