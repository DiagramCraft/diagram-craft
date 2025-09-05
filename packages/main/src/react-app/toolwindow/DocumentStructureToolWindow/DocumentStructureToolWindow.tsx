import { LayerListPanel } from './LayerListPanel';
import { TagsPanel } from './TagsPanel';
import { DocumentPanel } from './DocumentPanel';
import { ToolWindow } from '../ToolWindow';

export const DocumentStructureToolWindow = () => {
  return (
    <ToolWindow.Root id={'document-structure'} defaultTab={'layer'}>
      <ToolWindow.Tab id={'layer'} title={'Layer'}>
        <ToolWindow.TabContent>
          <LayerListPanel />
        </ToolWindow.TabContent>
      </ToolWindow.Tab>
      <ToolWindow.Tab id={'document'} title={'Document'}>
        <ToolWindow.TabContent>
          <DocumentPanel />
        </ToolWindow.TabContent>
      </ToolWindow.Tab>
      <ToolWindow.Tab id={'tags'} title={'Tags'}>
        <ToolWindow.TabContent>
          <TagsPanel />
        </ToolWindow.TabContent>
      </ToolWindow.Tab>
    </ToolWindow.Root>
  );
};
