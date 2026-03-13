import { Sidebar, SidebarBottomToolbar, SidebarPage } from './Sidebar';
import {
  TbCodeAsterisk,
  TbDatabaseCog,
  TbHistory,
  TbPentagonPlus,
  TbPresentation,
  TbSearch,
  TbSparkles,
  TbStack
} from 'react-icons/tb';
import { PickerToolWindow } from './toolwindow/PickerToolWindow/PickerToolWindow';
import { DocumentStructureToolWindow } from './toolwindow/DocumentStructureToolWindow/DocumentStructureToolWindow';
import { HistoryToolWindow } from './toolwindow/HistoryToolWindow/HistoryToolWindow';
import { QueryToolWindow } from './toolwindow/QueryToolWindow/QueryToolWindow';
import { StoryToolWindow } from './toolwindow/StoryToolWindow/StoryToolWindow';
import { AIToolWindow } from './toolwindow/AIToolWindow/AIToolWindow';
import { ActionToolbarButton } from './toolbar/ActionToolbarButton';
import { TextToolWindow } from './toolwindow/TextToolWindow/TextToolWindow';
import { AppConfig } from '../appConfig';
import { ActionTooltip } from './components/ActionTooltip';

export const LeftSidebar = () => {
  return (
    <Sidebar
      id={'left-sidebar'}
      side={'left'}
      bottom={
        <SidebarBottomToolbar>
          <ActionToolbarButton action={'MODEL_CENTER'} arg={{}}>
            <TbDatabaseCog size={'17.5px'} />
          </ActionToolbarButton>
        </SidebarBottomToolbar>
      }
    >
      <SidebarPage icon={TbPentagonPlus} tooltip={<ActionTooltip action={'SIDEBAR_OBJECTS'} />}>
        <PickerToolWindow />
      </SidebarPage>
      <SidebarPage icon={TbStack} tooltip={<ActionTooltip action={'SIDEBAR_STRUCTURE'} />}>
        <DocumentStructureToolWindow />
      </SidebarPage>
      <SidebarPage icon={TbHistory} tooltip={<ActionTooltip action={'SIDEBAR_HISTORY'} />}>
        <HistoryToolWindow />
      </SidebarPage>
      <SidebarPage icon={TbSearch} tooltip={<ActionTooltip action={'SIDEBAR_SEARCH'} />}>
        <QueryToolWindow />
      </SidebarPage>
      <SidebarPage
        icon={TbPresentation}
        tooltip={<ActionTooltip action={'SIDEBAR_STORY_PLAYER'} />}
      >
        <StoryToolWindow />
      </SidebarPage>
      <SidebarPage
        icon={TbCodeAsterisk}
        tooltip={<ActionTooltip action={'SIDEBAR_DIAGRAM_CODE'} />}
      >
        <TextToolWindow />
      </SidebarPage>
      {AppConfig.get().ai.provider !== 'none' && (
        <SidebarPage icon={TbSparkles} tooltip={<ActionTooltip action={'SIDEBAR_AI'} />}>
          <AIToolWindow />
        </SidebarPage>
      )}
    </Sidebar>
  );
};
