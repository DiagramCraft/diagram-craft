import { AdvancedSearchTab } from './AdvancedSearchTab';
import { ToolWindow } from '../ToolWindow';

export const QueryToolWindow = () => {
  return (
    <ToolWindow.Root defaultTab={'advanced'}>
      <ToolWindow.Tab id={'advanced'} title={'Advanced'}>
        <ToolWindow.TabContent>
          <AdvancedSearchTab />
        </ToolWindow.TabContent>
      </ToolWindow.Tab>
    </ToolWindow.Root>
  );
};
