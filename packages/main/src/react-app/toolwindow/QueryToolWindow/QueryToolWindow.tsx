import { DJQLSearchTab } from './DJQLSearchTab';
import { SearchTab } from './SearchTab';
import { AdvancedSearchTab } from './AdvancedSearchTab';
import { ToolWindow } from '../ToolWindow';
import { QueryToolWindowProvider } from './QueryToolWindowContext';

export const QueryToolWindow = () => {
  return (
    <QueryToolWindowProvider>
      <ToolWindow.Root id={'query'} defaultTab={'search'}>
        <ToolWindow.Tab id={'search'} title={'Search'}>
          <SearchTab />
        </ToolWindow.Tab>
        <ToolWindow.Tab id={'advanced-search'} title={'Advanced'}>
          <AdvancedSearchTab />
        </ToolWindow.Tab>
        <ToolWindow.Tab id={'djql'} title={'DJQL'}>
          <DJQLSearchTab />
        </ToolWindow.Tab>
      </ToolWindow.Root>
    </QueryToolWindowProvider>
  );
};
