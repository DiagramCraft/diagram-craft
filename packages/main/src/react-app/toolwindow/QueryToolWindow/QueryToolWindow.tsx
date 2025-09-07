import { DJQLSearchTab } from './DJQLSearchTab';
import { SearchTab } from './SearchTab';
import { AdvancedSearchTab } from './AdvancedSearchTab';
import { ToolWindow } from '../ToolWindow';

export const QueryToolWindow = () => {
  return (
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
  );
};
