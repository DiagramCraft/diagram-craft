import { DJQLSearchTab } from './DJQLSearchTab';
import { SearchTab } from './SearchTab';
import { AdvancedSearchTab } from './AdvancedSearchTab';
import { ToolWindow } from '../ToolWindow';

export const QueryToolWindow = () => {
  return (
    <ToolWindow.Root id={'query'} defaultTab={'search'}>
      <ToolWindow.Tab id={'search'} title={'Search'}>
        <ToolWindow.TabContent>
          <SearchTab />
        </ToolWindow.TabContent>
      </ToolWindow.Tab>
      <ToolWindow.Tab id={'advanced-search'} title={'Advanced'}>
        <ToolWindow.TabContent>
          <AdvancedSearchTab />
        </ToolWindow.TabContent>
      </ToolWindow.Tab>
      <ToolWindow.Tab id={'djql'} title={'DJQL'}>
        <ToolWindow.TabContent>
          <DJQLSearchTab />
        </ToolWindow.TabContent>
      </ToolWindow.Tab>
    </ToolWindow.Root>
  );
};
