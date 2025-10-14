import { StoriesListPanel } from './StoriesListPanel';
import { StoryEditorPanel } from './StoryEditorPanel';
import { StoryPlayerPanel } from './StoryPlayerPanel';
import { ToolWindow } from '../ToolWindow';

export const StoryToolWindow = () => {
  return (
    <ToolWindow.Root id={'stories'} defaultTab={'list'}>
      <ToolWindow.Tab id={'list'} title={'Stories'}>
        <ToolWindow.TabContent>
          <StoriesListPanel />
        </ToolWindow.TabContent>
      </ToolWindow.Tab>
      <ToolWindow.Tab id={'editor'} title={'Editor'}>
        <ToolWindow.TabContent>
          <StoryEditorPanel />
        </ToolWindow.TabContent>
      </ToolWindow.Tab>
      <ToolWindow.Tab id={'player'} title={'Player'}>
        <ToolWindow.TabContent>
          <StoryPlayerPanel />
        </ToolWindow.TabContent>
      </ToolWindow.Tab>
    </ToolWindow.Root>
  );
};
