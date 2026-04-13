import { useApplication } from '../../../application';
import { isStackedUndoManager } from '@diagram-craft/model/undoManager';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { UndoStackPanel } from './UndoStackPanel';
import { ToolWindow } from '../ToolWindow';

export const HistoryToolWindow = () => {
  const application = useApplication();
  const redraw = useRedraw();
  useEventListener(application.model, 'activeDiagramChange', redraw);

  const showUndoStack = isStackedUndoManager(application.model.activeDiagram.undoManager);

  return (
    <ToolWindow.Root id={'history'} defaultTab={'undo'}>
      {showUndoStack && (
        <ToolWindow.Tab id={'undo'} title={'Undo Stack'}>
          <ToolWindow.TabContent>
            <UndoStackPanel />
          </ToolWindow.TabContent>
        </ToolWindow.Tab>
      )}
      <ToolWindow.Tab id={'history'} title={'Document History'}>
        <ToolWindow.TabContent>
          <div className={'cmp-panel__headless'} style={{ fontSize: '11px' }}>
            <div>Document History</div>
          </div>
        </ToolWindow.TabContent>
      </ToolWindow.Tab>
    </ToolWindow.Root>
  );
};
