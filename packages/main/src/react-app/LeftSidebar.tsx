import { SideBar, SideBarBottomToolbar, SideBarPage } from './SideBar';
import {
  TbDatabaseCog,
  TbHistory,
  TbPentagonPlus,
  TbSearch,
  TbStack,
  TbPresentation
} from 'react-icons/tb';
import { PickerToolWindow } from './toolwindow/PickerToolWindow/PickerToolWindow';
import { DocumentStructureToolWindow } from './toolwindow/DocumentStructureToolWindow/DocumentStructureToolWindow';
import { HistoryToolWindow } from './toolwindow/HistoryToolWindow/HistoryToolWindow';
import { QueryToolWindow } from './toolwindow/QueryToolWindow/QueryToolWindow';
import { StoryToolWindow } from './toolwindow/StoryToolWindow/StoryToolWindow';
import { ActionToolbarButton } from './toolbar/ActionToolbarButton';

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
    </SideBar>
  );
};
