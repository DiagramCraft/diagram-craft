import { SideBar, SideBarBottomToolbar, SideBarPage } from './SideBar';
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
    <SideBar
      side={'left'}
      bottom={
        <SideBarBottomToolbar>
          <ActionToolbarButton action={'MODEL_CENTER'} arg={{}}>
            <TbDatabaseCog size={'17.5px'} />
          </ActionToolbarButton>
        </SideBarBottomToolbar>
      }
    >
      <SideBarPage icon={TbPentagonPlus} tooltip={<ActionTooltip action={'SIDEBAR_OBJECTS'} />}>
        <PickerToolWindow />
      </SideBarPage>
      <SideBarPage icon={TbStack} tooltip={<ActionTooltip action={'SIDEBAR_STRUCTURE'} />}>
        <DocumentStructureToolWindow />
      </SideBarPage>
      <SideBarPage icon={TbHistory} tooltip={<ActionTooltip action={'SIDEBAR_HISTORY'} />}>
        <HistoryToolWindow />
      </SideBarPage>
      <SideBarPage icon={TbSearch} tooltip={<ActionTooltip action={'SIDEBAR_SEARCH'} />}>
        <QueryToolWindow />
      </SideBarPage>
      <SideBarPage
        icon={TbPresentation}
        tooltip={<ActionTooltip action={'SIDEBAR_STORY_PLAYER'} />}
      >
        <StoryToolWindow />
      </SideBarPage>
      <SideBarPage
        icon={TbCodeAsterisk}
        tooltip={<ActionTooltip action={'SIDEBAR_DIAGRAM_CODE'} />}
      >
        <TextToolWindow />
      </SideBarPage>
      {AppConfig.get().ai.provider !== 'none' && (
        <SideBarPage icon={TbSparkles} tooltip={<ActionTooltip action={'SIDEBAR_AI'} />}>
          <AIToolWindow />
        </SideBarPage>
      )}
    </SideBar>
  );
};
