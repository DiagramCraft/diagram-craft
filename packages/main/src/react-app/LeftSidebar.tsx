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
import { useApplication } from '../application';
import { $t } from '@diagram-craft/utils/localize';

export const LeftSidebar = () => {
  const app = useApplication();
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
      <SideBarPage icon={TbPentagonPlus} tooltip={$t(app.actions['SIDEBAR_OBJECTS']!.name)}>
        <PickerToolWindow />
      </SideBarPage>
      <SideBarPage icon={TbStack} tooltip={$t(app.actions['SIDEBAR_STRUCTURE']!.name)}>
        <DocumentStructureToolWindow />
      </SideBarPage>
      <SideBarPage icon={TbHistory} tooltip={$t(app.actions['SIDEBAR_HISTORY']!.name)}>
        <HistoryToolWindow />
      </SideBarPage>
      <SideBarPage icon={TbSearch} tooltip={$t(app.actions['SIDEBAR_SEARCH']!.name)}>
        <QueryToolWindow />
      </SideBarPage>
      <SideBarPage icon={TbPresentation} tooltip={$t(app.actions['SIDEBAR_STORY_PLAYER']!.name)}>
        <StoryToolWindow />
      </SideBarPage>
      <SideBarPage icon={TbCodeAsterisk} tooltip={$t(app.actions['SIDEBAR_DIAGRAM_CODE']!.name)}>
        <TextToolWindow />
      </SideBarPage>
      {AppConfig.get().ai.provider !== 'none' && (
        <SideBarPage icon={TbSparkles} tooltip={$t(app.actions['SIDEBAR_AI']!.name)}>
          <AIToolWindow />
        </SideBarPage>
      )}
    </SideBar>
  );
};
