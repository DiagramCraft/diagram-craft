import { useDiagram } from '../../../application';
import { isStackedUndoManager } from '@diagram-craft/model/undoManager';
import { useRedraw } from '../../hooks/useRedraw';
import { TbCircleArrowRightFilled, TbCircleDotted } from 'react-icons/tb';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { useEffect } from 'react';

const formatTimestamp = (ts: Date | undefined) => {
  if (!ts) {
    return '';
  }
  return `[${ts.toLocaleTimeString()}]`;
};

export const UndoStackPanel = () => {
  const diagram = useDiagram();
  const undoManager = diagram.undoManager;
  const redraw = useRedraw();

  useEffect(() => {
    if (!isStackedUndoManager(undoManager)) return;
    undoManager.on('change', redraw);
    return () => undoManager.off('change', redraw);
  }, [undoManager, redraw]);

  if (!isStackedUndoManager(undoManager)) return null;

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
