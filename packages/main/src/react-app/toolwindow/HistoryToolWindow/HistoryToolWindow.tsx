import { UndoStackPanel } from './UndoStackPanel';
import { ToolWindow } from '../ToolWindow';

export const HistoryToolWindow = () => {
  return (
    <ToolWindow.Root defaultTab={'undo'}>
      <ToolWindow.Tab id={'undo'} title={'Undo Stack'}>
        <ToolWindow.TabContent>
          <UndoStackPanel />
        </ToolWindow.TabContent>
      </ToolWindow.Tab>
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
