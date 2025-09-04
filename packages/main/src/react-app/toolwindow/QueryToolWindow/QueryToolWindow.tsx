import { AdvancedSearchTab } from './AdvancedSearchTab';
import { SearchTab } from './SearchTab';
import { ToolWindow } from '../ToolWindow';

export const QueryToolWindow = () => {
  return (
    <ToolWindow.Root defaultTab={'search'}>
      <ToolWindow.Tab id={'search'} title={'Search'}>
        <ToolWindow.TabContent>
          <SearchTab />
        </ToolWindow.TabContent>
      </ToolWindow.Tab>
      <ToolWindow.Tab id={'advanced'} title={'Advanced'}>
        <ToolWindow.TabContent>
          <AdvancedSearchTab />
        </ToolWindow.TabContent>
      </ToolWindow.Tab>
    </ToolWindow.Root>
  );
};
