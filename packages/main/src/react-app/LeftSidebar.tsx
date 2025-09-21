import { SideBar, SideBarBottomToolbar, SideBarPage } from './SideBar';
import { TbDatabaseCog, TbHistory, TbPentagonPlus, TbSearch, TbStack } from 'react-icons/tb';
import { PickerToolWindow } from './toolwindow/PickerToolWindow/PickerToolWindow';
import { DocumentStructureToolWindow } from './toolwindow/DocumentStructureToolWindow/DocumentStructureToolWindow';
import { HistoryToolWindow } from './toolwindow/HistoryToolWindow/HistoryToolWindow';
import { QueryToolWindow } from './toolwindow/QueryToolWindow/QueryToolWindow';
import { ActionToggleButton } from './toolbar/ActionToggleButton';

export const LeftSidebar = () => {
  return (
    <SideBar
      side={'left'}
      bottom={
        <SideBarBottomToolbar>
          <ActionToggleButton action={'TOGGLE_HELP'}>
            <TbDatabaseCog size={'17.5px'} />
          </ActionToggleButton>
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
    </SideBar>
  );
};
