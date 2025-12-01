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
      <SideBarPage icon={TbPentagonPlus}>
        <PickerToolWindow />
      </SideBarPage>
      <SideBarPage icon={TbStack}>
        <DocumentStructureToolWindow />
      </SideBarPage>
      <SideBarPage icon={TbHistory}>
        <HistoryToolWindow />
      </SideBarPage>
      <SideBarPage icon={TbSearch}>
        <QueryToolWindow />
      </SideBarPage>
      <SideBarPage icon={TbPresentation}>
        <StoryToolWindow />
      </SideBarPage>
      <SideBarPage icon={TbCodeAsterisk}>
        <TextToolWindow />
      </SideBarPage>
      <SideBarPage icon={TbSparkles}>
        <AIToolWindow />
      </SideBarPage>
    </SideBar>
  );
};
