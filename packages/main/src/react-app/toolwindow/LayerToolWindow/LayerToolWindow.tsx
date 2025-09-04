import { LayerList } from './LayerList';
import { TagsPanel } from './TagsPanel';
import { DocumentPanel } from './DocumentPanel';
import { ToolWindow } from '../ToolWindow';

export const LayerToolWindow = () => {
  return (
    <ToolWindow.Root defaultTab={'layer'}>
      <ToolWindow.Tab id={'layer'} title={'Layer'}>
        <ToolWindow.TabContent>
          <div className={'cmp-panel__headless cmp-panel__headless--no-padding'}>
            <LayerList />
          </div>
        </ToolWindow.TabContent>
      </ToolWindow.Tab>
      <ToolWindow.Tab id={'document'} title={'Document'}>
        <ToolWindow.TabContent>
          <div className={'cmp-panel__headless cmp-panel__headless--no-padding'}>
            <DocumentPanel />
          </div>
        </ToolWindow.TabContent>
      </ToolWindow.Tab>
      <ToolWindow.Tab id={'tags'} title={'Tags'}>
        <ToolWindow.TabContent>
          <div className={'cmp-panel__headless cmp-panel__headless--no-padding'}>
            <TagsPanel />
          </div>
        </ToolWindow.TabContent>
      </ToolWindow.Tab>
    </ToolWindow.Root>
  );
};
