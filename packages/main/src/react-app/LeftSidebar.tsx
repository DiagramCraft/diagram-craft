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
      <SideBarPage icon={TbPentagonPlus} tooltip={'Objects'}>
        <PickerToolWindow />
      </SideBarPage>
      <SideBarPage icon={TbStack} tooltip={'Structure'}>
        <DocumentStructureToolWindow />
      </SideBarPage>
      <SideBarPage icon={TbHistory} tooltip={'History'}>
        <HistoryToolWindow />
      </SideBarPage>
      <SideBarPage icon={TbSearch} tooltip={'Search'}>
        <QueryToolWindow />
      </SideBarPage>
      <SideBarPage icon={TbPresentation} tooltip={'Story Player'}>
        <StoryToolWindow />
      </SideBarPage>
      <SideBarPage icon={TbCodeAsterisk} tooltip={'Diagram as Code'}>
        <TextToolWindow />
      </SideBarPage>
      {AppConfig.get().ai.provider !== 'none' && (
        <SideBarPage icon={TbSparkles} tooltip={'AI'}>
          <AIToolWindow />
        </SideBarPage>
      )}
    </SideBar>
  );
};
