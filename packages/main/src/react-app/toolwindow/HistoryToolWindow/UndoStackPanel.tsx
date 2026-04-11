import { useDiagram } from '../../../application';
import type { StackedUndoManager } from '@diagram-craft/model/undoManager';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { TbCircleArrowRightFilled, TbCircleDotted } from 'react-icons/tb';
import { ToolWindowPanel } from '../ToolWindowPanel';

const formatTimestamp = (ts: Date | undefined) => {
  if (!ts) {
    return '';
  }
  return `[${ts.toLocaleTimeString()}]`;
};

export const UndoStackPanel = () => {
  const diagram = useDiagram();
  const undoManager = diagram.undoManager as StackedUndoManager;
  const redraw = useRedraw();
  useEventListener(undoManager, 'change', redraw);

  const redoActions = undoManager.redoableActions;
  const undoActions = undoManager.undoableActions.toReversed();

  return (
    <ToolWindowPanel
      mode={'headless'}
      id={'undo-stack'}
      title={'Undo Stack'}
      isEmpty={redoActions.length === 0 && undoActions.length === 0}
    >
      <div className={'util-vstack'} style={{ fontSize: '11px' }}>
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
    </ToolWindowPanel>
  );
};
